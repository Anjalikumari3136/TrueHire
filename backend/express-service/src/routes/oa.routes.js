import { Router } from "express";
import { authenticate } from "../middleware/auth.middleware.js";
import {
  startOA,
  submitOA,
  finalReport,
  getReport,
  listReports,
  downloadReport,
} from "../controllers/oa.controller.js";

const router = Router();

// All routes are JWT-protected; the verified token is forwarded to FastAPI.
router.post("/start", authenticate, startOA);
router.post("/submit", authenticate, submitOA);

// Final report: generate-once (persist + PDF + email), then reuse the stored one.
router.post("/final-report", authenticate, finalReport);

// Dashboard: read stored report + history; download the stored PDF (ownership enforced).
router.get("/report", authenticate, getReport);
router.get("/reports", authenticate, listReports);
router.get("/report/pdf", authenticate, downloadReport);

export default router;
