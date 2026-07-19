import api from "../api/axios.js";

/**
 * Main Dashboard API service.
 *
 * Architecture: React → Express (JWT verify) → DB. The shared axios instance
 * (src/api/axios.js) points at the Express service and attaches the JWT, so all
 * data returned is scoped to the logged-in user (ownership enforced server-side).
 */

/** Aggregated Main Dashboard data (stats, active interview, history, insights, activity). */
export async function getDashboard() {
  const res = await api.get("/api/dashboard");
  return res.data;
}

/** Current authenticated user profile (name, email, avatar) — reuses existing /api/auth/me. */
export async function getMe() {
  const res = await api.get("/api/auth/me");
  return res.data.user;
}

/** Interview history list (all sessions, newest first). */
export async function getInterviewHistory() {
  const res = await api.get("/api/oa/reports");
  return res.data.reports || [];
}

/** A single stored report by interviewId (for /dashboard/report/:interviewId). */
export async function getReportById(interviewId) {
  const res = await api.get(`/api/oa/report/${encodeURIComponent(interviewId)}`);
  return res.data;
}

/** Full dynamic activity feed (newest first). */
export async function getActivity() {
  const res = await api.get("/api/activity");
  return res.data.activity || [];
}

/** Update the user's profile fields (reuses existing PUT /api/auth/profile). */
export async function updateProfile(payload) {
  const res = await api.put("/api/auth/profile", payload);
  return res.data.user;
}

/** Upload a new profile picture (reuses existing POST /api/auth/avatar). */
export async function uploadAvatar(file) {
  const form = new FormData();
  form.append("avatar", file);
  // Let the browser set the multipart boundary (override the JSON default).
  const res = await api.post("/api/auth/avatar", form, {
    headers: { "Content-Type": undefined },
  });
  return res.data.user;
}

/** Change password (reuses existing PUT /api/auth/password). */
export async function changePassword(payload) {
  const res = await api.put("/api/auth/password", payload);
  return res.data;
}

/** Persist per-user dashboard preferences (accent color). */
export async function updatePreferences(payload) {
  const res = await api.put("/api/auth/preferences", payload);
  return res.data;
}
