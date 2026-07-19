import { useState, useEffect, useRef } from "react";
import { Link, useNavigate, useLocation } from "react-router-dom";
import { ShieldCheck, Mail, RefreshCw } from "lucide-react";
import AuthLayout from "../components/auth/AuthLayout";
import Button from "../components/auth/Button";
import { verifyOTPApi, resendOTPApi } from "../api/auth.api.js";
import "./OtpPage.css";

/* ── Left panel illustration ── */
const OtpIllustration = () => (
  <svg viewBox="0 0 380 300" fill="none" xmlns="http://www.w3.org/2000/svg"
    style={{ width: "100%", maxWidth: 360 }} aria-hidden="true">
    <defs>
      <linearGradient id="gOtp" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stopColor="#6366f1" />
        <stop offset="100%" stopColor="#a855f7" />
      </linearGradient>
    </defs>
    <circle cx="190" cy="150" r="120" stroke="rgba(99,102,241,0.12)" strokeWidth="1.5" strokeDasharray="6 4" />
    <circle cx="190" cy="150" r="85" stroke="rgba(168,85,247,0.1)" strokeWidth="1" strokeDasharray="4 6" />
    {/* Shield */}
    <path d="M190 60 L230 82 L230 130 Q230 165 190 185 Q150 165 150 130 L150 82 Z"
      fill="url(#gOtp)" opacity="0.85" />
    {/* Checkmark */}
    <path d="M174 128l10 10 22-22" stroke="white" strokeWidth="3.5"
      strokeLinecap="round" strokeLinejoin="round" />
    {/* Envelope */}
    <rect x="70" y="195" width="100" height="68" rx="12"
      fill="rgba(99,102,241,0.12)" stroke="rgba(99,102,241,0.35)" strokeWidth="1.5" />
    <path d="M70 210 L120 240 L170 210" stroke="rgba(99,102,241,0.5)" strokeWidth="1.5" fill="none" />
    {/* OTP boxes */}
    {[210, 240, 270, 300].map((x, i) => (
      <g key={i}>
        <rect x={x} y="200" width="36" height="44" rx="8"
          fill="rgba(168,85,247,0.12)" stroke="rgba(168,85,247,0.35)" strokeWidth="1.5" />
        <rect x={x + 10} y="218" width="16" height="8" rx="4"
          fill="rgba(168,85,247,0.5)" />
      </g>
    ))}
    {/* Sparkles */}
    <path d="M60 80l2 5 5 2-5 2-2 5-2-5-5-2 5-2z" fill="rgba(99,102,241,0.6)" />
    <path d="M320 80l1.5 3.5 3.5 1.5-3.5 1.5-1.5 3.5-1.5-3.5-3.5-1.5 3.5-1.5z"
      fill="rgba(168,85,247,0.6)" />
  </svg>
);

const OTP_LENGTH = 6;
const RESEND_COOLDOWN = 60;

export default function OtpPage() {
  const navigate = useNavigate();
  const location = useLocation();

  // email and flow passed via router state from SignupPage
  const email = location.state?.email || "";
  const flow = location.state?.flow || "signup";

  const [otp, setOtp] = useState(Array(OTP_LENGTH).fill(""));
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [loading, setLoading] = useState(false);
  const [resendLoading, setResendLoading] = useState(false);
  const [cooldown, setCooldown] = useState(0);

  const inputRefs = useRef([]);

  // Redirect if no email in state
  useEffect(() => {
    if (!email) navigate("/signup");
  }, [email, navigate]);

  // Cooldown timer
  useEffect(() => {
    if (cooldown <= 0) return;
    const timer = setTimeout(() => setCooldown((c) => c - 1), 1000);
    return () => clearTimeout(timer);
  }, [cooldown]);

  const handleChange = (index, value) => {
    if (!/^\d*$/.test(value)) return;
    const newOtp = [...otp];
    newOtp[index] = value.slice(-1);
    setOtp(newOtp);
    setError("");
    if (value && index < OTP_LENGTH - 1) {
      inputRefs.current[index + 1]?.focus();
    }
  };

  const handleKeyDown = (index, e) => {
    if (e.key === "Backspace" && !otp[index] && index > 0) {
      inputRefs.current[index - 1]?.focus();
    }
  };

  const handlePaste = (e) => {
    e.preventDefault();
    const pasted = e.clipboardData.getData("text").replace(/\D/g, "").slice(0, OTP_LENGTH);
    const newOtp = Array(OTP_LENGTH).fill("");
    pasted.split("").forEach((char, i) => { newOtp[i] = char; });
    setOtp(newOtp);
    inputRefs.current[Math.min(pasted.length, OTP_LENGTH - 1)]?.focus();
  };

  const handleVerify = async (e) => {
    e.preventDefault();
    const code = otp.join("");
    if (code.length < OTP_LENGTH) {
      setError("Please enter the complete 6-digit OTP.");
      return;
    }
    setError("");
    setLoading(true);
    try {
      const data = await verifyOTPApi({ email, otp: code });
      localStorage.setItem("truehire_token", data.token);
      localStorage.setItem("truehire_user", JSON.stringify(data.user));
      setSuccess("Email verified! Redirecting…");
      setTimeout(() => navigate("/home", { replace: true }), 1500);
    } catch (err) {
      setError(err?.response?.data?.message || "OTP verification failed. Try again.");
    } finally {
      setLoading(false);
    }
  };

  const handleResend = async () => {
    if (cooldown > 0 || resendLoading) return;
    setResendLoading(true);
    setError("");
    try {
      await resendOTPApi({ email });
      setSuccess("A new OTP has been sent to your email.");
      setCooldown(RESEND_COOLDOWN);
      setOtp(Array(OTP_LENGTH).fill(""));
      inputRefs.current[0]?.focus();
    } catch (err) {
      setError(err?.response?.data?.message || "Failed to resend OTP. Try again.");
    } finally {
      setResendLoading(false);
    }
  };

  const leftPanel = (
    <div className="auth-left-content">
      <div className="auth-illustration">
        <OtpIllustration />
      </div>
      <h1 className="auth-left-heading">
        Verify Your <span>Email</span>
      </h1>
      <p className="auth-left-subtitle">
        We've sent a 6-digit code to your inbox. Enter it below to activate your account.
      </p>
      <div className="auth-left-badges">
        <span className="auth-badge"><span className="auth-badge-dot" /><ShieldCheck size={12} />Secure Verification</span>
        <span className="auth-badge"><span className="auth-badge-dot" /><Mail size={12} />Check Spam Folder</span>
        <span className="auth-badge"><span className="auth-badge-dot" /><RefreshCw size={12} />Valid for 10 mins</span>
      </div>
    </div>
  );

  return (
    <AuthLayout left={leftPanel}>
      <h2 className="auth-card-title">Enter OTP</h2>
      <p className="auth-card-subtitle">
        Code sent to <strong style={{ color: "var(--clr-primary, #818cf8)" }}>{email}</strong>
      </p>

      <form className="auth-form otp-form" onSubmit={handleVerify} noValidate id="otp-verify-form">
        {/* OTP boxes */}
        <div className="otp-boxes" onPaste={handlePaste}>
          {otp.map((digit, i) => (
            <input
              key={i}
              id={`otp-box-${i}`}
              type="text"
              inputMode="numeric"
              maxLength={1}
              className={`otp-box${digit ? " otp-box--filled" : ""}${error ? " otp-box--error" : ""}`}
              value={digit}
              onChange={(e) => handleChange(i, e.target.value)}
              onKeyDown={(e) => handleKeyDown(i, e)}
              ref={(el) => (inputRefs.current[i] = el)}
              autoComplete="one-time-code"
            />
          ))}
        </div>

        {error && <p className="otp-error">{error}</p>}
        {success && <p className="otp-success">{success}</p>}

        <Button type="submit" variant="primary" loading={loading} id="verify-otp-btn">
          Verify Email
        </Button>

        <div className="otp-resend">
          <button
            type="button"
            className={`otp-resend-btn${cooldown > 0 || resendLoading ? " otp-resend-btn--disabled" : ""}`}
            onClick={handleResend}
            disabled={cooldown > 0 || resendLoading}
            id="resend-otp-btn"
          >
            {resendLoading
              ? "Sending…"
              : cooldown > 0
              ? `Resend OTP in ${cooldown}s`
              : "Resend OTP"}
          </button>
        </div>

        <p className="auth-bottom">
          Wrong email?{" "}
          <Link to="/signup" id="back-to-signup-link">Go back</Link>
        </p>
      </form>
    </AuthLayout>
  );
}
