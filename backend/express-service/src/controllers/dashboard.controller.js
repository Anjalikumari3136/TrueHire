import prisma from "../config/prisma.js";
import { getActivityFeed } from "../services/activity.service.js";

/**
 * Main Dashboard controller.
 *
 * Aggregates everything the new post-login Main Dashboard (/home) needs, in a
 * single authenticated call, computed exclusively from the logged-in user's own
 * database records (User + Resume + InterviewReport). No fake / hardcoded data,
 * and never any other user's data — every query is scoped to req.user.id.
 *
 * This is purely additive: it reads existing tables and does not touch the
 * interview workflow, existing APIs, or report generation.
 */

// ── Helpers ──────────────────────────────────────────────────────────────────
function round1(n) {
  return Math.round((Number(n) || 0) * 10) / 10;
}

function pickInsights(reportJson) {
  if (!reportJson || typeof reportJson !== "object") return [];
  const insights = [];
  const strengths = Array.isArray(reportJson.strengths) ? reportJson.strengths : [];
  const improve = Array.isArray(reportJson.areas_to_improve) && reportJson.areas_to_improve.length
    ? reportJson.areas_to_improve
    : Array.isArray(reportJson.weaknesses)
    ? reportJson.weaknesses
    : [];

  strengths.slice(0, 3).forEach((t) => insights.push({ text: String(t), type: "positive" }));
  improve.slice(0, 3).forEach((t) => insights.push({ text: String(t), type: "improvement" }));
  return insights;
}

/** Percentage of key profile fields that are filled in. */
function computeProfileCompletion(user, resume) {
  const fields = [
    user.name,
    user.email,
    user.profileImage,
    user.github,
    user.linkedin,
    user.college,
    user.bio,
    resume?.resumeName,
  ];
  const filled = fields.filter((v) => v !== null && v !== undefined && String(v).trim() !== "").length;
  return Math.round((filled / fields.length) * 100);
}

// ── GET /api/dashboard ───────────────────────────────────────────────────────
export async function getDashboard(req, res) {
  try {
    const userId = req.user.id;

    // Scoped queries: résumé, reports, and the interview sessions (source of truth
    // for the ACTIVE interview — created at Build Profile, one per résumé).
    const [resume, reports, activeSession, sessionCount] = await Promise.all([
      prisma.resume.findUnique({ where: { userId } }),
      prisma.interviewReport.findMany({
        where: { userId },
        orderBy: { reportGeneratedAt: "desc" },
      }),
      prisma.interviewSession.findFirst({
        where: { userId, status: "in_progress" },
        orderBy: { startedAt: "desc" },
      }),
      prisma.interviewSession.count({ where: { userId } }),
    ]);

    const completedInterviews = reports.length;
    const scored = reports
      .map((r) => (typeof r.overallScore === "number" ? r.overallScore : null))
      .filter((n) => n !== null);
    const averageScore = scored.length ? round1(scored.reduce((a, b) => a + b, 0) / scored.length) : 0;
    const highestScore = scored.length ? round1(Math.max(...scored)) : 0;
    const reportsGenerated = reports.filter((r) => !!r.reportPdfPath).length;

    // Active interview = an in-progress InterviewSession (only ever ONE).
    const hasActive = !!activeSession;
    const activeInterview = hasActive
      ? {
          resume_name: activeSession.resumeName || resume?.resumeName || null,
          status: "In Progress",
          started_at: activeSession.startedAt,
          current_round: activeSession.currentRound,
          progress_percent: null, // enriched from client localStorage on the dashboard
          interview_id: activeSession.interviewSessionId,
        }
      : null;

    // Total interviews = distinct sessions (fallback to reports for legacy data
    // created before sessions existed).
    const totalInterviews = Math.max(sessionCount, completedInterviews + (hasActive ? 1 : 0));

    const latest = reports[0] || null;
    const latestReport = latest
      ? {
          interview_id: latest.interviewId,
          overall_score: latest.overallScore,
          hiring_recommendation:
            latest.reportJson?.hiring_recommendation ||
            latest.reportJson?.final_recommendation ||
            null,
          performance_rating: latest.reportJson?.performance_rating || null,
          generated_at: latest.reportGeneratedAt,
          pdf_available: !!latest.reportPdfPath,
        }
      : null;

    const recentInterviews = reports.slice(0, 5).map((r) => ({
      interview_id: r.interviewId,
      resume_name: r.resumeName,
      date: r.reportGeneratedAt,
      overall_score: r.overallScore,
      status: "Completed",
      completed_rounds: r.completedRounds,
      pdf_available: !!r.reportPdfPath,
    }));

    const latestCompletedRounds = Array.isArray(latest?.completedRounds)
      ? latest.completedRounds.length
      : 0;

    // Real, merged, newest-first activity feed (top 6 for the dashboard).
    const recentActivity = await getActivityFeed(userId, 6);

    const dashboard = {
      user: {
        name: req.user.name,
        email: req.user.email,
        github: req.user.github || null,
        linkedin: req.user.linkedin || null,
        college: req.user.college || null,
        current_role: req.user.currentRole || null,
        target_role: req.user.targetRole || null,
        member_since: req.user.createdAt,
        profile_completion: computeProfileCompletion(req.user, resume),
      },
      stats: {
        total_interviews: totalInterviews,
        completed_interviews: completedInterviews,
        active_interview: hasActive ? 1 : 0,
        average_score: averageScore,
        highest_score: highestScore,
        reports_generated: reportsGenerated,
      },
      active_interview: activeInterview,
      recent_interviews: recentInterviews,
      latest_report: latestReport,
      ai_insights: pickInsights(latest?.reportJson),
      progress: {
        overall_success: averageScore,
        completed_rounds_percent: Math.round((latestCompletedRounds / 3) * 100),
        pending_interviews: hasActive ? 1 : 0,
        average_performance: averageScore,
      },
      profile: {
        name: req.user.name,
        email: req.user.email,
        github: req.user.github || null,
        member_since: req.user.createdAt,
        profile_completion: computeProfileCompletion(req.user, resume),
      },
      recent_activity: recentActivity,
    };

    return res.status(200).json(dashboard);
  } catch (err) {
    console.error("[getDashboard] error:", err);
    return res.status(500).json({ success: false, message: "Failed to load dashboard." });
  }
}
