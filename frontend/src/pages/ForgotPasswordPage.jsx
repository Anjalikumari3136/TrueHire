import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Mail, Lock, KeyRound, ShieldCheck } from "lucide-react";
import AuthLayout from "../components/auth/AuthLayout";
import InputField from "../components/auth/InputField";
import Button from "../components/auth/Button";
import { forgotPasswordApi, verifyResetOTPApi, resetPasswordApi } from "../api/auth.api.js";
import "./ForgotPasswordPage.css";

/* ── Left panel illustration ── */
const ForgotIllustration = () => (
  <svg viewBox="0 0 380 300" fill="none" xmlns="http://www.w3.org/2000/svg"
    style={{ width: "100%", maxWidth: 360 }} aria-hidden="true">
    <defs>
      <linearGradient id="gFP" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stopColor="#6366f1" />
        <stop offset="100%" stopColor="#a855f7" />
      </linearGradient>
    </defs>
    <circle cx="190" cy="150" r="120" stroke="rgba(99,102,241,0.12)" strokeWidth="1.5" strokeDasharray="6 4" />
    {/* Lock body */}
    <rect x="152" y="140" width="76" height="64" rx="14" fill="url(#gFP)" opacity="0.85" />
    {/* Lock shackle */}
    <path d="M168 140 L168 116 Q168 95 190 95 Q212 95 212 116 L212 140"
      stroke="rgba(99,102,241,0.6)" strokeWidth="8" strokeLinecap="round" fill="none" />
    {/* Keyhole */}
    <circle cx="190" cy="165" r="10" fill="rgba(255,255,255,0.2)" />
    <rect x="186" y="168" width="8" height="18" rx="3" fill="rgba(255,255,255,0.2)" />
    {/* Floating sparkles */}
    <path d="M80 80l2 5 5 2-5 2-2 5-2-5-5-2 5-2z" fill="rgba(99,102,241,0.6)" />
    <path d="M310 100l1.5 3.5 3.5 1.5-3.5 1.5-1.5 3.5-1.5-3.5-3.5-1.5 3.5-1.5z"
      fill="rgba(168,85,247,0.6)" />
    <path d="M60 220l1 2.5 2.5 1-2.5 1-1 2.5-1-2.5-2.5-1 2.5-1z"
      fill="rgba(20,184,166,0.5)" />
    <path d="M320 230l1.5 3.5 3.5 1.5-3.5 1.5-1.5 3.5-1.5-3.5-3.5-1.5 3.5-1.5z"
      fill="rgba(99,102,241,0.5)" />
  </svg>
);

/* ── Password strength (reused logic) ── */
function getStrength(pw) {
  let score = 0;
  if (!pw) return 0;
  if (pw.length >= 8) score++;
  if (/[A-Z]/.test(pw)) score++;
  if (/[0-9]/.test(pw)) score++;
  if (/[^A-Za-z0-9]/.test(pw)) score++;
  return score;
}

const STRENGTH_LABELS = ["", "Weak", "Fair", "Good", "Strong"];
const STRENGTH_CLASSES = ["", "weak", "fair", "good", "strong"];
const BAR_CLASSES = ["", "active-weak", "active-fair", "active-good", "active-strong"];

function PasswordStrength({ password }) {
  const score = getStrength(password);
  if (!password) return null;
  return (
    <div className="pw-strength">
      <div className="pw-strength-bars">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className={`pw-bar${i <= score ? ` ${BAR_CLASSES[score]}` : ""}`} />
        ))}
      </div>
      <span className={`pw-strength-label ${STRENGTH_CLASSES[score]}`}>
        {STRENGTH_LABELS[score]}
      </span>
    </div>
  );
}

// Steps: "email" → "otp" → "reset" → "done"
const STEPS = ["email", "otp", "reset", "done"];

export default function ForgotPasswordPage() {
  const navigate = useNavigate();
  const [step, setStep] = useState("email");
  const [email, setEmail] = useState("");
  const [otp, setOtp] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [loading, setLoading] = useState(false);

  // ── Step 1: Request OTP ──────────────────────────────────────
  const handleSendOTP = async (e) => {
    e.preventDefault();
    if (!email.trim()) return setError("Email is required.");
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return setError("Invalid email address.");
    setError("");
    setLoading(true);
    try {
      await forgotPasswordApi({ email });
      setSuccess("OTP sent! Check your inbox.");
      setStep("otp");
    } catch (err) {
      setError(err?.response?.data?.message || "Failed to send OTP. Try again.");
    } finally {
      setLoading(false);
    }
  };

  // ── Step 2: Verify OTP ───────────────────────────────────────
  const handleVerifyOTP = async (e) => {
    e.preventDefault();
    if (!otp.trim() || otp.length < 6) return setError("Enter the complete 6-digit OTP.");
    setError("");
    setLoading(true);
    try {
      await verifyResetOTPApi({ email, otp });
      setSuccess("OTP verified! Set your new password.");
      setStep("reset");
    } catch (err) {
      setError(err?.response?.data?.message || "Invalid or expired OTP.");
    } finally {
      setLoading(false);
    }
  };

  // ── Step 3: Reset Password ───────────────────────────────────
  const handleResetPassword = async (e) => {
    e.preventDefault();
    if (!newPassword) return setError("New password is required.");
    if (newPassword.length < 8) return setError("Password must be at least 8 characters.");
    if (newPassword !== confirmPassword) return setError("Passwords do not match.");
    setError("");
    setLoading(true);
    try {
      await resetPasswordApi({ email, otp, newPassword });
      setSuccess("Password reset successfully!");
      setStep("done");
    } catch (err) {
      setError(err?.response?.data?.message || "Failed to reset password. Try again.");
    } finally {
      setLoading(false);
    }
  };

  const leftPanel = (
    <div className="auth-left-content">
      <div className="auth-illustration">
        <ForgotIllustration />
      </div>
      <h1 className="auth-left-heading">
        Reset Your <span>Password</span>
      </h1>
      <p className="auth-left-subtitle">
        Follow the simple steps to recover your TrueHire account securely.
      </p>
      <div className="auth-left-badges">
        <span className="auth-badge"><span className="auth-badge-dot" /><Mail size={12} />Email OTP</span>
        <span className="auth-badge"><span className="auth-badge-dot" /><ShieldCheck size={12} />Secure Reset</span>
        <span className="auth-badge"><span className="auth-badge-dot" /><KeyRound size={12} />New Password</span>
      </div>
    </div>
  );

  /* ── Step indicator ── */
  const stepIndex = STEPS.indexOf(step);
  const stepLabels = ["Email", "Verify OTP", "New Password", "Done"];

  return (
    <AuthLayout left={leftPanel}>
      <h2 className="auth-card-title">Forgot Password</h2>

      {/* Step progress */}
      <div className="fp-steps">
        {stepLabels.slice(0, 3).map((label, i) => (
          <div key={i} className={`fp-step${i < stepIndex ? " fp-step--done" : i === stepIndex ? " fp-step--active" : ""}`}>
            <div className="fp-step-circle">
              {i < stepIndex ? "✓" : i + 1}
            </div>
            <span className="fp-step-label">{label}</span>
          </div>
        ))}
      </div>

      <form className="auth-form" noValidate>
        {/* ── Step 1: Email ── */}
        {step === "email" && (
          <>
            <p className="auth-card-subtitle" style={{ marginBottom: "0.5rem" }}>
              Enter your registered email and we'll send you a reset code.
            </p>
            <InputField
              label="Email Address"
              type="email"
              placeholder="you@example.com"
              value={email}
              onChange={(e) => { setEmail(e.target.value); setError(""); }}
              icon={Mail}
              error={error}
            />
            {success && <p className="fp-success">{success}</p>}
            <Button type="button" variant="primary" loading={loading}
              id="send-reset-otp-btn" onClick={handleSendOTP}>
              Send OTP
            </Button>
          </>
        )}

        {/* ── Step 2: OTP ── */}
        {step === "otp" && (
          <>
            <p className="auth-card-subtitle" style={{ marginBottom: "0.5rem" }}>
              Enter the 6-digit code sent to <strong style={{ color: "#818cf8" }}>{email}</strong>
            </p>
            <InputField
              label="OTP Code"
              type="text"
              placeholder="Enter 6-digit OTP"
              value={otp}
              onChange={(e) => { setOtp(e.target.value.replace(/\D/g, "").slice(0, 6)); setError(""); }}
              icon={KeyRound}
              error={error}
            />
            {success && <p className="fp-success">{success}</p>}
            <Button type="button" variant="primary" loading={loading}
              id="verify-reset-otp-btn" onClick={handleVerifyOTP}>
              Verify OTP
            </Button>
            <button type="button" className="fp-back-btn"
              onClick={() => { setStep("email"); setError(""); setSuccess(""); }}>
              ← Back
            </button>
          </>
        )}

        {/* ── Step 3: New Password ── */}
        {step === "reset" && (
          <>
            <p className="auth-card-subtitle" style={{ marginBottom: "0.5rem" }}>
              Choose a strong password for your account.
            </p>
            <div>
              <InputField
                label="New Password"
                type="password"
                placeholder="Min. 8 characters"
                value={newPassword}
                onChange={(e) => { setNewPassword(e.target.value); setError(""); }}
                icon={Lock}
              />
              <PasswordStrength password={newPassword} />
            </div>
            <InputField
              label="Confirm Password"
              type="password"
              placeholder="Repeat new password"
              value={confirmPassword}
              onChange={(e) => { setConfirmPassword(e.target.value); setError(""); }}
              icon={Lock}
              error={error}
            />
            {!error && <p style={{ color: "#f87171", fontSize: "0.82rem", margin: "0" }}>{error}</p>}
            {success && <p className="fp-success">{success}</p>}
            <Button type="button" variant="primary" loading={loading}
              id="reset-password-btn" onClick={handleResetPassword}>
              Reset Password
            </Button>
          </>
        )}

        {/* ── Done ── */}
        {step === "done" && (
          <div className="fp-done">
            <div className="fp-done-icon">✓</div>
            <h3 className="fp-done-title">Password Reset!</h3>
            <p className="fp-done-text">
              Your password has been updated successfully. You can now sign in with your new password.
            </p>
            <Button type="button" variant="primary" id="go-to-login-btn"
              onClick={() => navigate("/login")}>
              Go to Sign In
            </Button>
          </div>
        )}
      </form>

      {step !== "done" && (
        <p className="auth-bottom">
          Remember your password?{" "}
          <Link to="/login" id="back-to-login-link">Sign In</Link>
        </p>
      )}
    </AuthLayout>
  );
}
