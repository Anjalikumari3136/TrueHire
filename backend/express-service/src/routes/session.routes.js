import { Router } from "express";
import { authenticate } from "../middleware/auth.middleware.js";
import {
  uploadProfile,
  buildProfileProxy,
  resumeInterview,
  saveRoundResultHandler,
  getProgress,
} from "../controllers/session.controller.js";

const router = Router();

// Build Profile (proxied to FastAPI) → creates a new InterviewSession.
router.post("/build-profile", authenticate, uploadProfile.single("file"), buildProfileProxy);

// Resume the pending interview without re-uploading the résumé.
router.post("/resume", authenticate, resumeInterview);

// Persist a Technical/HR round (transcript + report) — those rounds talk to
// FastAPI directly from the browser, so there is no proxy hook for them.
router.post("/round-result", authenticate, saveRoundResultHandler);

// Durable round-progression gate (OA → Technical → HR).
router.get("/progress", authenticate, getProgress);

export default router;
