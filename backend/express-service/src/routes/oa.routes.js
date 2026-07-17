import { Router } from "express";
import { authenticate } from "../middleware/auth.middleware.js";
import { startOA, submitOA, finalReport } from "../controllers/oa.controller.js";

const router = Router();

// All routes are JWT-protected; the verified token is forwarded to FastAPI.
router.post("/start", authenticate, startOA);
router.post("/submit", authenticate, submitOA);
router.post("/final-report", authenticate, finalReport);

export default router;
