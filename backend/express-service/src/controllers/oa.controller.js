import axios from "axios";
import { randomUUID } from "crypto";
import prisma from "../config/prisma.js";
import { generateReportPdf } from "../services/report-pdf.service.js";
import { uploadReportPdf, downloadReportPdf } from "../services/report-storage.service.js";
import { sendInterviewReportEmail } from "../services/mail.service.js";

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
 */
export async function finalReport(req, res) {
  const userId = req.user.id;

  try {
    const resume = await prisma.resume.findUnique({ where: { userId } });
    const currentResumeUrl = resume?.resumeUrl || null;

    // ── 1. Generate-once: reuse the stored report for this résumé session ──
    const latest = await prisma.interviewReport.findFirst({
      where: { userId },
      orderBy: { reportVersion: "desc" },
    });

    if (latest && latest.reportPdfPath && latest.resumeSnapshotUrl === currentResumeUrl) {
      return res.status(200).json({
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
      return res.status(status).json({ success: false, message });
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
    } catch (pdfErr) {
      console.error("[finalReport] PDF generation/storage failed:", pdfErr.message);
      // Interview stays completed and the report JSON is stored — just no PDF/email.
      return res.status(200).json({
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
    } catch (mailErr) {
      console.error("[finalReport] email send failed (non-fatal):", mailErr.message);
    }

    return res.status(200).json({
      report,
      completed_rounds: completedRounds,
      interview_id: interviewId,
      report_version: version,
      pdf_available: true,
      email_sent: emailSent,
    });
  } catch (err) {
    console.error("[finalReport] unexpected error:", err);
    return res
      .status(500)
      .json({ success: false, message: "Failed to finalize interview report." });
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

    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", `attachment; filename="${fileName}"`);
    res.setHeader("Content-Length", buffer.length);
    return res.send(buffer);
  } catch (err) {
    console.error("[downloadReport] error:", err);
    return res.status(500).json({ success: false, message: "Failed to download report PDF." });
  }
}
