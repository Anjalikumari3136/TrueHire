import { Router } from "express";
import { authenticate } from "../middleware/auth.middleware.js";
import { getDashboard } from "../controllers/dashboard.controller.js";

const router = Router();

// Aggregated Main Dashboard data for the authenticated user (ownership-scoped).
router.get("/", authenticate, getDashboard);

export default router;
