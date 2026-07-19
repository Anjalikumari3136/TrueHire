import multer from "multer";
import prisma from "../config/prisma.js";
import { logActivity } from "../services/activity.service.js";
import {
  ROUNDS,
  saveRoundResult,
  markRoundCompleted,
  getRoundProgress,
} from "../services/round-result.service.js";

/**
 * Interview Session lifecycle controller.
 *
 * Build Profile is proxied through Express so that, on success, a brand-new
 * InterviewSession row is created (one per résumé upload). The previous active
 * session (if any) is archived — never overwritten — preserving full history.
 * The heavy AI work (résumé parse + GitHub + profile) still runs in FastAPI /
 * LangGraph unchanged; Express only owns the DB session lifecycle.
 */

const FASTAPI_URL = process.env.FASTAPI_URL || "http://localhost:8000";

// Résumé PDFs up to 5 MB, kept in memory to forward to FastAPI.
export const uploadProfile = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 },
});

// Text fields the frontend sends with the résumé (all optional except github).
const FORM_FIELDS = [
  "github_username",
  "college_name",
  "linkedin_profile",
  "leetcode_profile",
  "other_coding_profile",
  "graduation_year",
  "cgpa",
];

/**
 * POST /api/interview/build-profile  (multipart: file + fields)
 * Proxies to FastAPI /build-profile, then creates a new InterviewSession.
 */
export async function buildProfileProxy(req, res) {
  const userId = req.user.id;

  if (!req.file) {
    return res.status(400).json({ success: false, message: "No résumé file uploaded." });
  }

  // ── 1. Proxy the multipart request to FastAPI (AI profile build) ──────────
  let profile;
  try {
    const form = new FormData();
    form.append("file", new Blob([req.file.buffer], { type: req.file.mimetype }), req.file.originalname);
    for (const key of FORM_FIELDS) {
      const val = req.body[key];
      if (val !== undefined && val !== null && val !== "") form.append(key, val);
    }

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 120000);
    let fastapiRes;
    try {
      fastapiRes = await fetch(`${FASTAPI_URL}/build-profile`, {
        method: "POST",
        headers: { Authorization: req.headers.authorization },
        body: form,
        signal: controller.signal,
      });
    } finally {
      clearTimeout(timeout);
    }

    const data = await fastapiRes.json().catch(() => ({}));
    if (!fastapiRes.ok) {
      const message = data.detail || data.message || "Failed to build candidate profile.";
      return res.status(fastapiRes.status || 502).json({ success: false, message });
    }
    profile = data;
  } catch (err) {
    console.error("[buildProfileProxy] FastAPI proxy failed:", err.message);
    return res.status(502).json({ success: false, message: "Unable to reach the AI service." });
  }

  // ── 2. New interview session: archive the prior active one, create a new one ─
  try {
    const resume = await prisma.resume.findUnique({ where: { userId } });

    await prisma.interviewSession.updateMany({
      where: { userId, status: "in_progress" },
      data: { status: "archived" },
    });

    const session = await prisma.interviewSession.create({
      data: {
        userId,
        resumeName: resume?.resumeName || null,
        resumeSnapshotUrl: resume?.resumeUrl || null,
        profileJson: profile, // persist the analysis so Resume can reuse it
        status: "in_progress",
        currentRound: "OA",
      },
    });

    await logActivity(userId, "profile_built", "Profile built — new interview started", {
      interviewSessionId: session.interviewSessionId,
    });

    return res.status(200).json({ ...profile, interview_session_id: session.interviewSessionId });
  } catch (err) {
    // The profile itself succeeded; failing to record the session must not lose it.
    console.error("[buildProfileProxy] session creation failed (non-fatal):", err.message);
    return res.status(200).json(profile);
  }
}

/**
 * POST /api/interview/resume
 * Resume the candidate's pending (in-progress) interview WITHOUT re-uploading the
 * résumé. Re-seeds FastAPI's in-memory profile from the stored analysis so
 * OA/Technical/HR questions come from the SAME résumé, and returns the profile +
 * progress so the frontend can jump straight to the round selection.
 */
export async function resumeInterview(req, res) {
  const userId = req.user.id;
  try {
    const session = await prisma.interviewSession.findFirst({
      where: { userId, status: "in_progress" },
      orderBy: { startedAt: "desc" },
    });

    if (!session) {
      return res.status(404).json({ success: false, message: "No interview in progress to resume." });
    }
    if (!session.profileJson) {
      return res
        .status(409)
        .json({ success: false, message: "This interview cannot be resumed (missing profile). Please start a new one." });
    }

    // Re-seed FastAPI's in-memory profile from the stored analysis (no re-upload,
    // no re-run of the AI). Non-fatal if FastAPI is still holding it in memory.
    try {
      await fetch(`${FASTAPI_URL}/restore-profile`, {
        method: "POST",
        headers: {
          Authorization: req.headers.authorization,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ profile: session.profileJson }),
      });
    } catch (err) {
      console.error("[resumeInterview] restore-profile failed (non-fatal):", err.message);
    }

    return res.status(200).json({
      interview_session_id: session.interviewSessionId,
      resume_name: session.resumeName,
      current_round: session.currentRound,
      completed_rounds: Array.isArray(session.completedRounds) ? session.completedRounds : [],
      profile: session.profileJson,
    });
  } catch (err) {
    console.error("[resumeInterview] error:", err);
    return res.status(500).json({ success: false, message: "Failed to resume interview." });
  }
}

/**
 * POST /api/interview/round-result
 *
 * Durably records a Technical or HR round once the client has received it from
 * FastAPI. Those two rounds are called from the browser DIRECTLY against the AI
 * service, so Express has no proxy hook to persist them — hence this small
 * additive ingestion endpoint. The conversation transcript and the round's own
 * report previously existed only in the FastAPI agent's memory.
 *
 * Body: { round, ai_session_id?, transcript?, report?, time_taken_seconds? }
 *
 * Always answers 200 so a persistence hiccup can never break the candidate's
 * interview — the client fires this and ignores the result.
 */
export async function saveRoundResultHandler(req, res) {
  try {
    const { round, ai_session_id, transcript, report, time_taken_seconds } = req.body || {};

    if (!ROUNDS.includes(round)) {
      return res.status(400).json({ success: false, message: "Unknown interview round." });
    }

    const saved = await saveRoundResult(req.user.id, round, {
      aiSessionId: ai_session_id ?? undefined,
      transcriptJson: transcript ?? undefined,
      reportJson: report ?? undefined,
      score: typeof report?.overall_score === "number" ? report.overall_score : undefined,
      timeTakenSeconds: typeof time_taken_seconds === "number" ? time_taken_seconds : undefined,
      submittedAt: new Date(),
      status: report ? "evaluated" : "submitted",
    });

    if (report) await markRoundCompleted(req.user.id, round);

    return res.status(200).json({ success: true, saved: !!saved });
  } catch (err) {
    console.error("[saveRoundResult] non-fatal:", err.message);
    return res.status(200).json({ success: false, saved: false });
  }
}

/**
 * GET /api/interview/progress
 * Server-side round-unlock gate (OA → Technical → HR). Read-only. The client
 * still keeps its localStorage copy for instant paint; this is the durable
 * source of truth that survives a cleared browser or a new device.
 */
export async function getProgress(req, res) {
  try {
    return res.status(200).json(await getRoundProgress(req.user.id));
  } catch (err) {
    console.error("[getProgress] error:", err);
    return res.status(500).json({ success: false, message: "Failed to load interview progress." });
  }
}
