import { Router } from "express";
import { authenticate } from "../middleware/auth.middleware.js";
import {
  upload,
  uploadResume,
  getMyResume,
  updateResume,
} from "../controllers/resume.controller.js";

const router = Router();

router.post("/upload", authenticate, upload.single("resume"), uploadResume);
router.get("/me", authenticate, getMyResume);
router.put("/update", authenticate, upload.single("resume"), updateResume);

export default router;
