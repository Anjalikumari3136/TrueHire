import api from "../api/axios.js";

/**
 * OA (Online Assessment) API service.
 *
 * Architecture:  React → Express (JWT verify + proxy) → FastAPI → Gemini
 * React NEVER calls FastAPI/Gemini directly. The shared axios instance
 * (src/api/axios.js) points at the Express service and attaches the JWT.
 */

/**
 * Start / resume the OA session.
 * Express verifies the JWT and forwards to FastAPI, which returns the
 * 5 personalized questions (generating them via Gemini on first call,
 * or resuming the existing session on subsequent calls — STEP 15).
 *
 * @returns {Promise<{session_id:string, questions:Array, duration_minutes:number, started_at:string, status:string, resumed:boolean}>}
 */
export async function startOA() {
  const res = await api.post("/api/oa/start");
  return res.data;
}

/**
 * Submit the completed assessment payload.
 * @param {object} payload - { session_id, language, question_ids, answers, started_at, ended_at, time_taken_seconds }
 */
export async function submitOA(payload) {
  const res = await api.post("/api/oa/submit", payload);
  return res.data;
}

/**
 * Fetch the final consolidated report across OA + Technical + HR + résumé.
 * @returns {Promise<{report:object, completed_rounds:string[]}>}
 */
export async function getFinalReport() {
  const res = await api.post("/api/oa/final-report");
  return res.data;
}
