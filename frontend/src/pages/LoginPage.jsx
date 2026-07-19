import { useState, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import { loginApi, googleLoginApi } from "../api/auth.api.js";
import { Mail, Lock, Briefcase, Users, Shield, Zap, AlertTriangle, CheckCircle, AlertCircle } from "lucide-react";
import AuthLayout from "../components/auth/AuthLayout";
import InputField from "../components/auth/InputField";
import Button from "../components/auth/Button";
import "./LoginPage.css";

/* ── Left panel illustration ── */
const HiringIllustration = () => (
  <svg
    viewBox="0 0 380 320"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    style={{ width: "100%", maxWidth: 380 }}
    aria-hidden="true"
  >
    {/* Background circles */}
    <circle cx="190" cy="160" r="140" fill="url(#lg1)" opacity="0.12" />
    <circle cx="190" cy="160" r="100" fill="url(#lg1)" opacity="0.1" />

    {/* Central person silhouette */}
    <circle cx="190" cy="100" r="36" fill="url(#lg1)" opacity="0.9" />
    <rect x="156" y="140" width="68" height="80" rx="20" fill="url(#lg1)" opacity="0.85" />

    {/* Document cards floating */}
    <g opacity="0.9">
      <rect x="28" y="80" width="90" height="64" rx="12" fill="rgba(99,102,241,0.18)" stroke="rgba(99,102,241,0.4)" strokeWidth="1.5" />
      <rect x="40" y="96" width="50" height="6" rx="3" fill="rgba(99,102,241,0.6)" />
      <rect x="40" y="108" width="66" height="4" rx="2" fill="rgba(255,255,255,0.25)" />
      <rect x="40" y="118" width="55" height="4" rx="2" fill="rgba(255,255,255,0.15)" />
      <circle cx="96" cy="130" r="8" fill="rgba(99,102,241,0.5)" />
    </g>

    {/* Right card */}
    <g opacity="0.9">
      <rect x="262" y="68" width="90" height="64" rx="12" fill="rgba(168,85,247,0.18)" stroke="rgba(168,85,247,0.4)" strokeWidth="1.5" />
      <rect x="274" y="84" width="50" height="6" rx="3" fill="rgba(168,85,247,0.6)" />
      <rect x="274" y="96" width="66" height="4" rx="2" fill="rgba(255,255,255,0.25)" />
      <rect x="274" y="106" width="42" height="4" rx="2" fill="rgba(255,255,255,0.15)" />
      <circle cx="334" cy="118" r="8" fill="rgba(34,197,94,0.7)" />
    </g>

    {/* Checkmark badge */}
    <circle cx="220" cy="72" r="18" fill="rgba(34,197,94,0.2)" stroke="rgba(34,197,94,0.5)" strokeWidth="1.5" />
    <path d="M212 72l5 5 9-9" stroke="#22c55e" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />

    {/* Stars / sparkles */}
    <path d="M80 40l2 5 5 2-5 2-2 5-2-5-5-2 5-2z" fill="rgba(99,102,241,0.7)" />
    <path d="M310 200l1.5 3.5 3.5 1.5-3.5 1.5-1.5 3.5-1.5-3.5-3.5-1.5 3.5-1.5z" fill="rgba(168,85,247,0.7)" />
    <path d="M50 220l1.5 3.5 3.5 1.5-3.5 1.5-1.5 3.5-1.5-3.5-3.5-1.5 3.5-1.5z" fill="rgba(99,102,241,0.5)" />
    <path d="M340 140l1 2.5 2.5 1-2.5 1-1 2.5-1-2.5-2.5-1 2.5-1z" fill="rgba(168,85,247,0.5)" />

    {/* Bottom bar */}
    <rect x="100" y="240" width="180" height="44" rx="14" fill="rgba(22,22,34,0.85)" stroke="rgba(99,102,241,0.3)" strokeWidth="1" />
    <circle cx="122" cy="262" r="10" fill="url(#lg1)" opacity="0.85" />
    <rect x="140" y="255" width="80" height="6" rx="3" fill="rgba(255,255,255,0.7)" />
    <rect x="140" y="265" width="55" height="4" rx="2" fill="rgba(255,255,255,0.3)" />

    <defs>
      <linearGradient id="lg1" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stopColor="#6366f1" />
        <stop offset="100%" stopColor="#a855f7" />
      </linearGradient>
    </defs>
  </svg>
);

function validate({ email, password }) {
  const errors = {};
  if (!email.trim()) errors.email = "Email is required.";
  else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))
    errors.email = "Enter a valid email address.";
  if (!password) errors.password = "Password is required.";
  return errors;
}

export default function LoginPage() {
  const navigate = useNavigate();
  const [form, setForm] = useState({ email: "", password: "" });
  const [errors, setErrors] = useState({});
  const [apiError, setApiError] = useState("");
  const [remember, setRemember] = useState(false);
  const [loading, setLoading] = useState(false);
  const [toast, setToast] = useState(null); // { message: "", type: "" }
  const [usedEmails, setUsedEmails] = useState([]);

  // Load previously used email addresses
  useEffect(() => {
    try {
      const saved = localStorage.getItem("truehire_used_emails");
      if (saved) {
        setUsedEmails(JSON.parse(saved));
      }
    } catch (e) {
      console.error("Failed to load used emails:", e);
    }
  }, []);

  // Toast Auto-clear
  useEffect(() => {
    if (toast) {
      const timer = setTimeout(() => setToast(null), 4000);
      return () => clearTimeout(timer);
    }
  }, [toast]);

  // Autofill email on mount if Remember Me was active
  useEffect(() => {
    const isRemember = localStorage.getItem("truehire_remember") === "true";
    if (isRemember) {
      const emailSaved = localStorage.getItem("truehire_remember_email") || "";
      setForm((f) => ({ ...f, email: emailSaved }));
      setRemember(true);
    }
  }, []);

  const set = (field) => (e) =>
    setForm((f) => ({ ...f, [field]: e.target.value }));

  const saveAuthSession = (token, user) => {
    // Add email to list of used emails for auto-suggestion
    try {
      const saved = JSON.parse(localStorage.getItem("truehire_used_emails") || "[]");
      if (user.email && !saved.includes(user.email)) {
        saved.push(user.email);
        localStorage.setItem("truehire_used_emails", JSON.stringify(saved));
        setUsedEmails(saved);
      }
    } catch (e) {
      console.error("Failed to save email to used list:", e);
    }

    if (remember) {
      localStorage.setItem("truehire_token", token);
      localStorage.setItem("truehire_user", JSON.stringify(user));
      localStorage.setItem("truehire_remember", "true");
      localStorage.setItem("truehire_remember_email", user.email);

      sessionStorage.removeItem("truehire_token");
      sessionStorage.removeItem("truehire_user");
    } else {
      sessionStorage.setItem("truehire_token", token);
      sessionStorage.setItem("truehire_user", JSON.stringify(user));

      localStorage.removeItem("truehire_token");
      localStorage.removeItem("truehire_user");
      localStorage.removeItem("truehire_remember");
      localStorage.removeItem("truehire_remember_email");
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const errs = validate(form);
    if (Object.keys(errs).length) {
      setErrors(errs);
      return;
    }
    setErrors({});
    setApiError("");
    setLoading(true);
    try {
      const data = await loginApi({ email: form.email, password: form.password });
      saveAuthSession(data.token, data.user);
      navigate("/home", { replace: true });
    } catch (err) {
      const msg =
        err?.response?.data?.message ||
        "Login failed. Please check your credentials.";
      setApiError(msg);
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleLogin = async (googleData) => {
    setLoading(true);
    setApiError("");
    try {
      const data = await googleLoginApi({ ...googleData, signUpIfNotFound: false });
      saveAuthSession(data.token, data.user);
      navigate("/home", { replace: true });
    } catch (err) {
      const resData = err?.response?.data;
      if (resData && resData.userExists === false) {
        setToast({
          message: "No account found with this Google account. Create new account.",
          type: "warning"
        });
        setTimeout(() => {
          navigate("/signup");
        }, 3000);
      } else {
        const msg = resData?.message || "Google authentication failed. Please try again.";
        setApiError(msg);
      }
    } finally {
      setLoading(false);
    }
  };

  // Initialize official real Google Sign In Button
  useEffect(() => {
    const clientId = import.meta.env.VITE_GOOGLE_CLIENT_ID;
    if (!clientId) return;

    const initializeGoogleButton = () => {
      if (window.google) {
        window.google.accounts.id.initialize({
          client_id: clientId,
          callback: (response) => {
            handleGoogleLogin({ idToken: response.credential });
          }
        });

        const btnContainer = document.getElementById("google-signin-btn-container");
        if (btnContainer) {
          window.google.accounts.id.renderButton(
            btnContainer,
            {
              theme: "outline",
              size: "large",
              width: btnContainer.offsetWidth || "360",
              type: "standard",
              shape: "rectangular",
              text: "continue_with",
              logo_alignment: "center"
            }
          );
        }
      }
    };

    if (window.google) {
      initializeGoogleButton();
    } else {
      const interval = setInterval(() => {
        if (window.google) {
          clearInterval(interval);
          initializeGoogleButton();
        }
      }, 100);
      return () => clearInterval(interval);
    }
  }, []);

  const leftPanel = (
    <div className="auth-left-content">
      <div className="auth-illustration">
        <HiringIllustration />
      </div>
      <h1 className="auth-left-heading">
        Welcome <span>Back</span>
      </h1>
      <p className="auth-left-subtitle">
        Sign in to continue your hiring journey with TrueHire.
      </p>
      <div className="auth-left-badges">
        <span className="auth-badge"><span className="auth-badge-dot" /><Briefcase size={12} />Smart Matching</span>
        <span className="auth-badge"><span className="auth-badge-dot" /><Users size={12} />10k+ Hirers</span>
        <span className="auth-badge"><span className="auth-badge-dot" /><Zap size={12} />AI-Powered</span>
        <span className="auth-badge"><span className="auth-badge-dot" /><Shield size={12} />Secure</span>
      </div>
    </div>
  );

  return (
    <AuthLayout left={leftPanel}>
      <h2 className="auth-card-title">Sign In</h2>
      <p className="auth-card-subtitle">Access your TrueHire dashboard</p>

      <form className="auth-form" onSubmit={handleSubmit} noValidate id="login-form">
        <InputField
          label="Email Address"
          type="email"
          placeholder="you@example.com"
          value={form.email}
          onChange={set("email")}
          error={errors.email}
          icon={Mail}
          suggestions={usedEmails}
        />

        <InputField
          label="Password"
          type="password"
          placeholder="Enter your password"
          value={form.password}
          onChange={set("password")}
          error={errors.password}
          icon={Lock}
        />

        <div className="login-remember-row">
          <label className="login-checkbox-label">
            <input
              type="checkbox"
              checked={remember}
              onChange={(e) => setRemember(e.target.checked)}
              id="remember-me"
            />
            Remember me
          </label>
          <a
            className="login-forgot"
            href="/forgot-password"
            id="forgot-password-link"
            onClick={(e) => { e.preventDefault(); navigate("/forgot-password"); }}
          >
            Forgot password?
          </a>
        </div>

        {apiError && (
          <div className="auth-api-error">{apiError}</div>
        )}

        <Button type="submit" variant="primary" loading={loading} id="sign-in-btn">
          Sign In
        </Button>

        <div className="auth-divider">
          <div className="auth-divider-line" />
          <span className="auth-divider-text">OR</span>
          <div className="auth-divider-line" />
        </div>

        {/* Google OAuth Button Container */}
        {!import.meta.env.VITE_GOOGLE_CLIENT_ID ? (
          <div style={{
            fontSize: "0.82rem",
            color: "#eab308",
            textAlign: "center",
            padding: "10px",
            border: "1px dashed rgba(234, 179, 8, 0.3)",
            borderRadius: "8px",
            background: "rgba(234, 179, 8, 0.05)",
            width: "100%"
          }}>
            ℹ️ Configure <code>VITE_GOOGLE_CLIENT_ID</code> in the frontend <code>.env</code> file to enable Google login.
          </div>
        ) : (
          <div id="google-signin-btn-container" style={{ width: "100%", display: "flex", justifyContent: "center" }}></div>
        )}
      </form>

      <p className="auth-bottom">
        Don&apos;t have an account?{" "}
        <Link to="/signup" id="create-account-link">Create Account</Link>
      </p>

      {/* Toast Notification Popup */}
      {toast && (
        <div className={`toast-notification toast-notification--${toast.type}`} role="alert">
          {toast.type === "success" && <CheckCircle size={18} color="#10b981" />}
          {toast.type === "error" && <AlertCircle size={18} color="#ef4444" />}
          {toast.type === "warning" && <AlertTriangle size={18} color="#f59e0b" />}
          <span className="toast-notification-text">{toast.message}</span>
        </div>
      )}
    </AuthLayout>
  );
}
