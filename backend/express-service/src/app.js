import express from "express";
import cors from "cors";
import authRoutes from "./routes/auth.routes.js";
import resumeRoutes from "./routes/resume.routes.js";
import oaRoutes from "./routes/oa.routes.js";
import dashboardRoutes from "./routes/dashboard.routes.js";
import activityRoutes from "./routes/activity.routes.js";
import sessionRoutes from "./routes/session.routes.js";

const app = express();

/**
 * CORS.
 *
 * CLIENT_URL accepts a COMMA-SEPARATED list so the deployed frontend, Vercel
 * preview deployments and local dev can all be allowed at once. Set
 * CLIENT_ORIGIN_REGEX (e.g. `^https://.*\.vercel\.app$`) to allow Vercel's
 * per-commit preview URLs, which change on every push.
 *
 * Requests with no Origin header (server-to-server, curl, health checks) are
 * allowed — CORS is a browser policy and blocking them would break Render's
 * health check and the FastAPI → Express calls.
 */
const allowedOrigins = (process.env.CLIENT_URL || "http://localhost:5173,http://localhost:5174")
  .split(",")
  .map((o) => o.trim())
  .filter(Boolean);

const originRegex = process.env.CLIENT_ORIGIN_REGEX
  ? new RegExp(process.env.CLIENT_ORIGIN_REGEX)
  : null;

app.use(
  cors({
    origin(origin, callback) {
      if (!origin) return callback(null, true);
      if (allowedOrigins.includes(origin)) return callback(null, true);
      if (originRegex?.test(origin)) return callback(null, true);
      // Disallowed: reply WITHOUT the Access-Control-Allow-Origin header and let
      // the browser block it. Passing an Error here instead would turn every
      // stray cross-origin request into a 500, burying real errors in the logs.
      return callback(null, false);
    },
    credentials: true,
  })
);
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

/**
 * Express 5 leaves `req.body` UNDEFINED when there is nothing to parse (no body,
 * or a missing/mismatched Content-Type) — Express 4 defaulted it to `{}`.
 * Controllers destructure `req.body` directly, so without this a bodyless
 * request throws `Cannot destructure property 'email' of 'req.body'` and returns
 * a 500, instead of hitting the handler's own validation and returning 400.
 */
app.use((req, res, next) => {
  if (req.body === undefined) req.body = {};
  next();
});

app.use("/api/auth", authRoutes);
app.use("/api/resume", resumeRoutes);
app.use("/api/oa", oaRoutes);
app.use("/api/dashboard", dashboardRoutes);
app.use("/api/activity", activityRoutes);
app.use("/api/interview", sessionRoutes);

app.get("/", (req, res) => {
  res.json({
    success: true,
    message: "Welcome to TrueHire Backend 🚀",
  });
});

export default app;