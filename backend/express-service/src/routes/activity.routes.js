import { Router } from "express";
import { authenticate } from "../middleware/auth.middleware.js";
import { getActivity, postActivity } from "../controllers/activity.controller.js";

const router = Router();

router.get("/", authenticate, getActivity);
router.post("/", authenticate, postActivity);

export default router;
