import { getActivityFeed, logActivity } from "../services/activity.service.js";

// Whitelisted client-loggable event types (server logs report lifecycle itself).
const ALLOWED_TYPES = new Set([
  "profile_updated",
  "resume_uploaded",
  "profile_built",
  "resume_analysis_completed",
  "oa_started",
  "technical_started",
  "hr_started",
  "report_downloaded",
]);

// GET /api/activity — full dynamic activity feed for the authenticated user.
export async function getActivity(req, res) {
  try {
    const feed = await getActivityFeed(req.user.id);
    return res.status(200).json({ activity: feed });
  } catch (err) {
    console.error("[getActivity] error:", err);
    return res.status(500).json({ success: false, message: "Failed to load activity." });
  }
}

// POST /api/activity — log a client-observed event (type-validated, own user only).
export async function postActivity(req, res) {
  try {
    const { type, label } = req.body || {};
    if (!type || !ALLOWED_TYPES.has(type)) {
      return res.status(400).json({ success: false, message: "Invalid activity type." });
    }
    await logActivity(req.user.id, type, label || type.replace(/_/g, " "), null);
    return res.status(201).json({ success: true });
  } catch (err) {
    console.error("[postActivity] error:", err);
    return res.status(500).json({ success: false, message: "Failed to log activity." });
  }
}
