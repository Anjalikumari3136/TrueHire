import axios from "axios";

/**
 * OA (Online Assessment) controller.
 *
 * Express's only job here is JWT verification (done by the `authenticate`
 * middleware) + proxying to the FastAPI AI service. The verified Bearer token
 * is forwarded so FastAPI can resolve the candidate profile it already holds
 * and drive Gemini. React never calls FastAPI/Gemini directly.
 */

const FASTAPI_URL = process.env.FASTAPI_URL || "http://localhost:8000";

// POST /api/oa/start  → FastAPI POST /api/oa/generate
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

// POST /api/oa/submit → FastAPI POST /api/oa/submit
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

// POST /api/oa/final-report → FastAPI POST /api/oa/final-report
export async function finalReport(req, res) {
  try {
    const { data } = await axios.post(
      `${FASTAPI_URL}/api/oa/final-report`,
      {},
      { headers: { Authorization: req.headers.authorization }, timeout: 120000 }
    );
    return res.status(200).json(data);
  } catch (err) {
    const status = err.response?.status || 502;
    const message =
      err.response?.data?.detail ||
      err.response?.data?.message ||
      "Unable to generate final report.";
    return res.status(status).json({ success: false, message });
  }
}
