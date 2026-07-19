import { Router } from "express";
import { authenticate } from "../middleware/auth.middleware.js";
import {
  startOA,
  submitOA,
  oaRoundReport,
  finalReport,
  getReport,
  getReportById,
  listReports,
  downloadReport,
} from "../controllers/oa.controller.js";

const router = Router();

// All routes are JWT-protected; the verified token is forwarded to FastAPI.
router.post("/start", authenticate, startOA);
router.post("/submit", authenticate, submitOA);

// OA round evaluation report (same flow as the Technical round report).
router.post("/report", authenticate, oaRoundReport);

// Final report: generate-once (persist + PDF + email), then reuse the stored one.
router.post("/final-report", authenticate, finalReport);

// Dashboard: read stored report + history; download the stored PDF (ownership enforced).
// NOTE: `/report/pdf` must be registered BEFORE `/report/:interviewId` so the
// literal path is not captured by the param route.
router.get("/report", authenticate, getReport);
router.get("/reports", authenticate, listReports);
router.get("/report/pdf", authenticate, downloadReport);
router.get("/report/:interviewId", authenticate, getReportById);

export default router;
