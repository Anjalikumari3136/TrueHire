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
 *
 * On the FIRST completion this triggers the server to persist the report,
 * generate the PDF once, store it and email the candidate. On subsequent calls
 * the server returns the already-stored report (never regenerated).
 *
 * @returns {Promise<{report:object, completed_rounds:string[], interview_id?:string, pdf_available?:boolean, email_sent?:boolean}>}
 */
export async function getFinalReport() {
  const res = await api.post("/api/oa/final-report");
  return res.data;
}

/**
 * Download the stored report PDF (the same one attached to the email and shown
 * in the dashboard). Streams from Express with the JWT attached; ownership is
 * enforced server-side. Never regenerates the PDF.
 *
 * @param {string} [interviewId] - specific interview; defaults to the latest.
 */
export async function downloadReportPdf(interviewId) {
  const res = await api.get("/api/oa/report/pdf", {
    params: interviewId ? { id: interviewId } : {},
    responseType: "blob",
  });

  const blob = new Blob([res.data], { type: "application/pdf" });
  const url = window.URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;

  const disposition = res.headers?.["content-disposition"] || "";
  const match = /filename="?([^"]+)"?/.exec(disposition);
  link.download = match ? match[1] : "TrueHire_Interview_Report.pdf";

  document.body.appendChild(link);
  link.click();
  link.remove();
  window.URL.revokeObjectURL(url);
}
