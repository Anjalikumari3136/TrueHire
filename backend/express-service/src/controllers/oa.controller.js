import axios from "axios";
import { randomUUID } from "crypto";
import prisma from "../config/prisma.js";
import { generateReportPdf } from "../services/report-pdf.service.js";
import { uploadReportPdf, downloadReportPdf } from "../services/report-storage.service.js";
import { sendInterviewReportEmail } from "../services/mail.service.js";
import { logActivity } from "../services/activity.service.js";
import { saveRoundResult, markRoundCompleted } from "../services/round-result.service.js";

/**
 * OA (Online Assessment) controller.
 *
 * Express's only job for the AI rounds is JWT verification (via the
 * `authenticate` middleware) + proxying to the FastAPI AI service. React never
 * calls FastAPI/Gemini directly.
 *
 * The final-report flow additionally owns persistence, PDF generation, storage
 * and email — because Express (not FastAPI) owns Prisma, Supabase Storage and
 * Nodemailer. The PDF is generated exactly ONCE per interview session and then
 * reused everywhere (dashboard view, download, email attachment).
 */

const FASTAPI_URL = process.env.FASTAPI_URL || "http://localhost:8000";

// ── Helpers ──────────────────────────────────────────────────────────────────
function safeFileName(name) {
  return String(name || "Candidate").replace(/[^a-zA-Z0-9]+/g, "_") || "Candidate";
}

/** Wrap a handler result as { status, body } so it can be shared by callers. */
const out = (status, body) => ({ status, body });

/**
 * In-flight final-report work, keyed by userId. Concurrent requests share the
 * SAME promise, so the report is generated once and the email sent once even if
 * the client fires the endpoint multiple times simultaneously.
 */
const inFlightReports = new Map();

/**
 * Mark the user's current active interview session as completed and link it to
 * the report just produced. Non-fatal — a session bookkeeping failure must not
 * break the report response.
 */
async function completeActiveSession(userId, { interviewId, overallScore, reportAvailable, emailSent }) {
  try {
    // Prefer the in-progress session; fall back to the latest one so the report
    // is ALWAYS linked (this is what makes generate-once/email-once reliable).
    const active =
      (await prisma.interviewSession.findFirst({
        where: { userId, status: "in_progress" },
        orderBy: { startedAt: "desc" },
      })) ||
      (await prisma.interviewSession.findFirst({
        where: { userId },
        orderBy: { startedAt: "desc" },
      }));
    if (!active) return;
    await prisma.interviewSession.update({
      where: { id: active.id },
      data: {
        status: "completed",
        currentRound: "HR",
        completedAt: new Date(),
        reportInterviewId: interviewId ?? active.reportInterviewId,
        overallScore: typeof overallScore === "number" ? overallScore : active.overallScore,
        reportAvailable: reportAvailable ?? active.reportAvailable,
        emailSent: emailSent ?? active.emailSent,
      },
    });
  } catch (err) {
    console.error("[completeActiveSession] non-fatal:", err.message);
  }
}

function serializeMeta(row) {
  return {
    interview_id: row.interviewId,
    resume_name: row.resumeName,
    overall_score: row.overallScore,
    completed_rounds: row.completedRounds,
    report_version: row.reportVersion,
    pdf_available: !!row.reportPdfPath,
    email_sent: row.reportEmailSent,
    generated_at: row.reportGeneratedAt,
  };
}

// ── POST /api/oa/start → FastAPI POST /api/oa/generate ───────────────────────
export async function startOA(req, res) {
  try {
    const { data } = await axios.post(
      `${FASTAPI_URL}/api/oa/generate`,
      {},
      { headers: { Authorization: req.headers.authorization }, timeout: 120000 }
    );

    // Persist the generated question set. FastAPI holds it in memory only, so a
    // restart mid-assessment used to lose the candidate's paper entirely.
    // On `resumed: true` FastAPI returns the SAME questions, so re-saving is a
    // no-op update rather than a change.
    await saveRoundResult(req.user.id, "OA", {
      aiSessionId: data?.session_id ?? undefined,
      questionsJson: Array.isArray(data?.questions) ? data.questions : undefined,
      startedAt: data?.started_at ? new Date(data.started_at) : undefined,
      status: "in_progress",
    });

    return res.status(200).json(data);
  } catch (err) {
    const status = err.response?.status || 502;
    const message =
      err.response?.data?.detail ||
      err.response?.data?.message ||
      "Unable to generate assessment.";
    return res.status(status).json({ success: false, message });
  }
}

// ── POST /api/oa/submit → FastAPI POST /api/oa/submit ────────────────────────
export async function submitOA(req, res) {
  try {
    const { data } = await axios.post(`${FASTAPI_URL}/api/oa/submit`, req.body, {
      headers: { Authorization: req.headers.authorization },
      timeout: 30000,
    });

    // Persist the actual code the candidate wrote + how long they took. This was
    // previously never stored anywhere — only the AI's prose summary survived.
    const body = req.body || {};
    await saveRoundResult(req.user.id, "OA", {
      aiSessionId: body.session_id ?? undefined,
      answersJson: Array.isArray(body.answers) ? body.answers : undefined,
      language: body.language ?? undefined,
      startedAt: body.started_at ? new Date(body.started_at) : undefined,
      submittedAt: body.ended_at ? new Date(body.ended_at) : new Date(),
      timeTakenSeconds:
        typeof body.time_taken_seconds === "number" ? body.time_taken_seconds : undefined,
      status: "submitted",
    });
    await markRoundCompleted(req.user.id, "OA");

    return res.status(200).json(data);
  } catch (err) {
    const status = err.response?.status || 502;
    const message =
      err.response?.data?.detail ||
      err.response?.data?.message ||
      "Failed to submit assessment.";
    return res.status(status).json({ success: false, message });
  }
}

// ── POST /api/oa/report → FastAPI POST /api/oa/report ────────────────────────
// OA round evaluation report (mirrors the Technical round's report flow).
export async function oaRoundReport(req, res) {
  try {
    const { data } = await axios.post(
      `${FASTAPI_URL}/api/oa/report`,
      {},
      { headers: { Authorization: req.headers.authorization }, timeout: 120000 }
    );

    // Persist the OA round's own evaluation. Only the final CONSOLIDATED report
    // was ever stored, so individual round reports could not be re-opened later.
    await saveRoundResult(req.user.id, "OA", {
      reportJson: data ?? undefined,
      score: typeof data?.overall_score === "number" ? data.overall_score : undefined,
      status: "evaluated",
    });

    return res.status(200).json(data);
  } catch (err) {
    const status = err.response?.status || 502;
    const message =
      err.response?.data?.detail ||
      err.response?.data?.message ||
      "Unable to generate the OA report.";
    return res.status(status).json({ success: false, message });
  }
}

/**
 * POST /api/oa/final-report
 *
 * Generate-once orchestration:
 *   1. If a report already exists for the candidate's CURRENT résumé session and
 *      has a stored PDF → return it unchanged (never regenerate, never re-email).
 *   2. Otherwise: fetch the AI report JSON from FastAPI → persist → generate PDF
 *      once → store → email once.
 *
 * Response is backward compatible: `report` + `completed_rounds` are always
 * present (the existing frontend contract); extra metadata fields are additive.
 *
 * Failure isolation (per spec):
 *   - Report generation fails  → no email, log, return error.
 *   - PDF generation fails      → keep JSON, mark completed, log, don't crash.
 *   - Email sending fails       → everything stays stored, log, no rollback.
 *
 * Concurrency: requests are de-duplicated per user (see `finalReport`), because
 * the report page can fire this endpoint twice at once (React StrictMode
 * double-invokes effects in dev, remounts/reloads can do the same). Without that
 * guard both calls pass the "already generated?" check before either finishes,
 * producing two reports and TWO emails.
 */
async function buildFinalReport(req) {
  const userId = req.user.id;

  try {
    const resume = await prisma.resume.findUnique({ where: { userId } });
    const currentResumeUrl = resume?.resumeUrl || null;

    const latest = await prisma.interviewReport.findFirst({
      where: { userId },
      orderBy: { reportVersion: "desc" },
    });

    // ── 1. Generate-once is scoped to the INTERVIEW SESSION ────────────────
    // Each interview session produces exactly ONE report and ONE email. We must
    // NOT key this on the résumé snapshot: the interview flow uploads the résumé
    // straight to Build Profile and never writes the Resume table, so that value
    // is identical across interviews and would wrongly reuse the first report
    // forever (which is why later interviews never got an email).
    const currentSession = await prisma.interviewSession.findFirst({
      where: { userId },
      orderBy: { startedAt: "desc" },
    });

    if (currentSession) {
      if (currentSession.reportInterviewId) {
        const existing = await prisma.interviewReport.findUnique({
          where: { interviewId: currentSession.reportInterviewId },
        });
        if (existing) {
          return out(200, {
            report: existing.reportJson,
            completed_rounds: existing.completedRounds,
            interview_id: existing.interviewId,
            report_version: existing.reportVersion,
            pdf_available: !!existing.reportPdfPath,
            email_sent: existing.reportEmailSent,
            reused: true,
          });
        }
      }
      // This session has no report yet → generate a fresh one (and email it).
    } else if (latest && latest.reportPdfPath && latest.resumeSnapshotUrl === currentResumeUrl) {
      // Legacy fallback for data created before interview sessions existed.
      return out(200, {
        report: latest.reportJson,
        completed_rounds: latest.completedRounds,
        interview_id: latest.interviewId,
        report_version: latest.reportVersion,
        pdf_available: true,
        email_sent: latest.reportEmailSent,
        reused: true,
      });
    }

    // ── 2. Fetch the AI report JSON from FastAPI (LangGraph/Gemini) ────────
    let fastapiData;
    try {
      const { data } = await axios.post(
        `${FASTAPI_URL}/api/oa/final-report`,
        {},
        { headers: { Authorization: req.headers.authorization }, timeout: 120000 }
      );
      fastapiData = data;
    } catch (err) {
      // Report generation failed → do NOT send email; log; return proper response.
      const status = err.response?.status || 502;
      const message =
        err.response?.data?.detail ||
        err.response?.data?.message ||
        "Unable to generate final report.";
      console.error("[finalReport] report generation failed:", message);
      return out(status, { success: false, message });
    }

    const report = fastapiData.report || {};
    const completedRounds = Array.isArray(fastapiData.completed_rounds)
      ? fastapiData.completed_rounds
      : [];
    const overallScore =
      typeof report.overall_score === "number" ? report.overall_score : null;

    // ── 3. Persist the report row (new version; never overwrites old ones) ─
    const version = (latest?.reportVersion || 0) + 1;
    const interviewId = `iv_${randomUUID()}`;

    const row = await prisma.interviewReport.create({
      data: {
        userId,
        interviewId,
        interviewSessionId: currentSession?.interviewSessionId || null,
        resumeName: resume?.resumeName || null,
        resumeSnapshotUrl: currentResumeUrl,
        reportJson: report,
        overallScore,
        completedRounds,
        reportVersion: version,
      },
    });

    // ── 4. Generate the PDF exactly once (failure must not crash the API) ──
    let pdfBuffer = null;
    try {
      pdfBuffer = await generateReportPdf(report, {
        name: req.user.name,
        email: req.user.email,
        resumeName: resume?.resumeName,
        interviewId,
        interviewDate: new Date(row.reportGeneratedAt).toISOString().slice(0, 10),
        reportVersion: version,
        generatedAt: new Date(row.reportGeneratedAt).toISOString(),
      });
      const pdfPath = await uploadReportPdf(userId, interviewId, pdfBuffer);
      await prisma.interviewReport.update({
        where: { id: row.id },
        data: { reportPdfPath: pdfPath },
      });
      await logActivity(userId, "interview_completed", "Interview completed", { interviewId });
      await logActivity(userId, "report_generated", "Report generated", { interviewId });
    } catch (pdfErr) {
      console.error("[finalReport] PDF generation/storage failed:", pdfErr.message);
      // Interview stays completed and the report JSON is stored — just no PDF/email.
      await completeActiveSession(userId, { interviewId, overallScore, reportAvailable: false, emailSent: false });
      return out(200, {
        report,
        completed_rounds: completedRounds,
        interview_id: interviewId,
        report_version: version,
        pdf_available: false,
        email_sent: false,
        warning: "Report saved, but PDF generation failed.",
      });
    }

    // ── 5. Email the candidate once (failure must not roll anything back) ──
    let emailSent = false;
    try {
      await sendInterviewReportEmail({
        to: req.user.email,
        candidateName: req.user.name,
        pdfBuffer,
        interviewId,
      });
      emailSent = true;
      await prisma.interviewReport.update({
        where: { id: row.id },
        data: { reportEmailSent: true, reportEmailSentAt: new Date() },
      });
      await logActivity(userId, "report_email_sent", "Report emailed to you", { interviewId });
    } catch (mailErr) {
      console.error("[finalReport] email send failed (non-fatal):", mailErr.message);
    }

    // Mark the active session completed + link the report.
    await completeActiveSession(userId, { interviewId, overallScore, reportAvailable: true, emailSent });

    return out(200, {
      report,
      completed_rounds: completedRounds,
      interview_id: interviewId,
      report_version: version,
      pdf_available: true,
      email_sent: emailSent,
    });
  } catch (err) {
    console.error("[finalReport] unexpected error:", err);
    return out(500, { success: false, message: "Failed to finalize interview report." });
  }
}

/**
 * POST /api/oa/final-report
 *
 * Thin wrapper that de-duplicates concurrent requests per user. The report page
 * can fire this twice at once (React StrictMode double-invokes effects in dev;
 * remounts/reloads/double-clicks can too). Both calls would otherwise pass the
 * "already generated?" check before either finished — producing two reports and
 * sending the email TWICE. Sharing one in-flight promise guarantees the report
 * is generated once and the candidate is emailed exactly once.
 */
export async function finalReport(req, res) {
  const userId = req.user.id;
  try {
    let work = inFlightReports.get(userId);
    if (!work) {
      work = buildFinalReport(req).finally(() => inFlightReports.delete(userId));
      inFlightReports.set(userId, work);
    }
    const { status, body } = await work;
    return res.status(status).json(body);
  } catch (err) {
    console.error("[finalReport] unexpected error:", err);
    return res.status(500).json({ success: false, message: "Failed to finalize interview report." });
  }
}

/**
 * GET /api/oa/report  → latest stored report meta + JSON for the dashboard.
 * Reads the stored report only — NEVER regenerates.
 */
export async function getReport(req, res) {
  try {
    const row = await prisma.interviewReport.findFirst({
      where: { userId: req.user.id },
      orderBy: { reportVersion: "desc" },
    });

    if (!row) {
      return res.status(200).json({ has_report: false, report: null });
    }

    return res.status(200).json({
      has_report: true,
      report: row.reportJson,
      ...serializeMeta(row),
    });
  } catch (err) {
    console.error("[getReport] error:", err);
    return res.status(500).json({ success: false, message: "Failed to load report." });
  }
}

/**
 * GET /api/oa/report/:interviewId → a specific stored report (for the
 * /dashboard/report/:interviewId deep-link). Ownership enforced. Read-only.
 */
export async function getReportById(req, res) {
  try {
    const row = await prisma.interviewReport.findUnique({
      where: { interviewId: String(req.params.interviewId) },
    });

    if (!row) {
      return res.status(404).json({ success: false, message: "Report not found." });
    }
    if (row.userId !== req.user.id) {
      return res
        .status(403)
        .json({ success: false, message: "You are not allowed to access this report." });
    }

    return res.status(200).json({
      report: row.reportJson,
      completed_rounds: row.completedRounds,
      ...serializeMeta(row),
    });
  } catch (err) {
    console.error("[getReportById] error:", err);
    return res.status(500).json({ success: false, message: "Failed to load report." });
  }
}

/**
 * GET /api/oa/reports → interview history (list). Read-only.
 */
export async function listReports(req, res) {
  try {
    const rows = await prisma.interviewReport.findMany({
      where: { userId: req.user.id },
      orderBy: { reportVersion: "desc" },
    });
    return res.status(200).json({ reports: rows.map(serializeMeta) });
  } catch (err) {
    console.error("[listReports] error:", err);
    return res.status(500).json({ success: false, message: "Failed to load report history." });
  }
}

/**
 * GET /api/oa/report/pdf[?id=<interviewId>] → stream the stored PDF.
 * Ownership is enforced: a user can only download their own report. Files are
 * never exposed publicly — the bytes are streamed through this authenticated
 * endpoint. NEVER regenerates the PDF.
 */
export async function downloadReport(req, res) {
  try {
    const userId = req.user.id;
    const { id } = req.query;

    const row = id
      ? await prisma.interviewReport.findUnique({ where: { interviewId: String(id) } })
      : await prisma.interviewReport.findFirst({
          where: { userId },
          orderBy: { reportVersion: "desc" },
        });

    if (!row) {
      return res.status(404).json({ success: false, message: "Report not found." });
    }
    // Ownership check — prevent unauthorized downloads.
    if (row.userId !== userId) {
      return res
        .status(403)
        .json({ success: false, message: "You are not allowed to access this report." });
    }
    if (!row.reportPdfPath) {
      return res
        .status(409)
        .json({ success: false, message: "PDF is not available for this report yet." });
    }

    const buffer = await downloadReportPdf(row.reportPdfPath);
    const fileName = `TrueHire_Interview_Report_${safeFileName(req.user.name)}.pdf`;

    await logActivity(userId, "report_downloaded", "Report downloaded", { interviewId: row.interviewId });

    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", `attachment; filename="${fileName}"`);
    res.setHeader("Content-Length", buffer.length);
    return res.send(buffer);
  } catch (err) {
    console.error("[downloadReport] error:", err);
    return res.status(500).json({ success: false, message: "Failed to download report PDF." });
  }
}
