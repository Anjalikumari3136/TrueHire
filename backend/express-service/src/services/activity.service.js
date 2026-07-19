import prisma from "../config/prisma.js";

/**
 * Activity feed service.
 *
 * The dashboard's "Recent Activity" is fully dynamic and scoped to one user.
 * Two real sources are merged (no fake/placeholder data):
 *   1. Logged events   — rows written to ActivityLog from the Express
 *                        controllers we own (report generated / emailed /
 *                        downloaded / interview completed).
 *   2. Derived events  — reconstructed from authoritative timestamps that
 *                        already exist on Resume / InterviewReport
 *                        (résumé uploaded, per-round completion).
 *
 * Merged, de-duplicated, and returned newest-first.
 */

const ROUND_LABEL = { OA: "OA completed", Technical: "Technical completed", HR: "HR completed" };

/** Write a real activity event. Never throws into the caller's happy path. */
export async function logActivity(userId, type, label, meta = null) {
  try {
    await prisma.activityLog.create({ data: { userId, type, label, meta: meta ?? undefined } });
  } catch (err) {
    console.error("[logActivity] failed:", err.message);
  }
}

function dedupeKey(type, ts) {
  return `${type}|${new Date(ts).toISOString().slice(0, 19)}`;
}

/**
 * Build the merged, newest-first activity feed for a user.
 * @param {string} userId
 * @param {number} [limit] - max items (omit for all)
 */
export async function getActivityFeed(userId, limit) {
  const [logged, resume, reports] = await Promise.all([
    prisma.activityLog.findMany({ where: { userId }, orderBy: { createdAt: "desc" } }),
    prisma.resume.findUnique({ where: { userId } }),
    prisma.interviewReport.findMany({
      where: { userId },
      orderBy: { reportGeneratedAt: "desc" },
      select: {
        interviewId: true,
        resumeName: true,
        completedRounds: true,
        reportGeneratedAt: true,
        reportEmailSent: true,
        reportEmailSentAt: true,
        reportPdfPath: true,
      },
    }),
  ]);

  const items = [];
  const seen = new Set();

  const push = (type, label, timestamp, meta) => {
    if (!timestamp) return;
    const key = dedupeKey(type, timestamp);
    if (seen.has(key)) return;
    seen.add(key);
    items.push({ type, label, timestamp, ...(meta ? { meta } : {}) });
  };

  // Logged events first (authoritative for downloads etc.)
  logged.forEach((row) => push(row.type, row.label, row.createdAt, row.meta || undefined));

  // Derived: résumé uploaded
  if (resume?.uploadedAt) {
    push("resume_uploaded", `Resume uploaded: ${resume.resumeName}`, resume.uploadedAt);
  }

  // Derived: per-report events (also covers reports created before logging existed)
  reports.forEach((r) => {
    (r.completedRounds || []).forEach((round) => {
      push(`${round.toLowerCase()}_completed`, ROUND_LABEL[round] || `${round} completed`, r.reportGeneratedAt, {
        interviewId: r.interviewId,
      });
    });
    push("interview_completed", "Interview completed", r.reportGeneratedAt, { interviewId: r.interviewId });
    push("report_generated", "Report generated", r.reportGeneratedAt, { interviewId: r.interviewId });
    if (r.reportEmailSent && r.reportEmailSentAt) {
      push("report_email_sent", "Report emailed to you", r.reportEmailSentAt, { interviewId: r.interviewId });
    }
  });

  items.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
  return typeof limit === "number" ? items.slice(0, limit) : items;
}
