import { useState, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import { signupApi, googleLoginApi } from "../api/auth.api.js";
import {
  User, Mail, Lock, Phone, MapPin, Briefcase, TrendingUp, Target,
  Rocket, Award, Star,
} from "lucide-react";
import AuthLayout from "../components/auth/AuthLayout";
import InputField from "../components/auth/InputField";
import Button from "../components/auth/Button";
import "./SignupPage.css";


/* ── Recruitment SVG illustration ── */
const RecruitIllustration = () => (
  <svg
    viewBox="0 0 380 300"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    style={{ width: "100%", maxWidth: 380 }}
    aria-hidden="true"
  >
    <defs>
      <linearGradient id="gReq" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stopColor="#6366f1" />
        <stop offset="100%" stopColor="#a855f7" />
      </linearGradient>
      <linearGradient id="gTeal" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stopColor="#14b8a6" />
        <stop offset="100%" stopColor="#6366f1" />
      </linearGradient>
    </defs>

    {/* Background ring */}
    <circle cx="190" cy="150" r="120" stroke="rgba(99,102,241,0.12)" strokeWidth="1.5" strokeDasharray="6 4" />
    <circle cx="190" cy="150" r="90" stroke="rgba(168,85,247,0.1)" strokeWidth="1" strokeDasharray="4 6" />

    {/* Ladder of growth */}
    <g opacity="0.9">
      <rect x="150" y="240" width="80" height="10" rx="5" fill="url(#gReq)" opacity="0.8" />
      <rect x="158" y="205" width="64" height="10" rx="5" fill="url(#gReq)" opacity="0.7" />
      <rect x="166" y="170" width="48" height="10" rx="5" fill="url(#gReq)" opacity="0.6" />
      <rect x="174" y="135" width="32" height="10" rx="5" fill="url(#gReq)" opacity="0.55" />
      {/* Vertical bars */}
      <rect x="154" y="140" width="8" height="115" rx="4" fill="url(#gReq)" opacity="0.3" />
      <rect x="218" y="140" width="8" height="115" rx="4" fill="url(#gReq)" opacity="0.3" />
    </g>

    {/* Person at top */}
    <circle cx="190" cy="105" r="26" fill="url(#gReq)" opacity="0.9" />
    <rect x="168" y="134" width="44" height="46" rx="14" fill="url(#gReq)" opacity="0.85" />

    {/* Star burst top */}
    <circle cx="190" cy="46" r="18" fill="rgba(99,102,241,0.2)" stroke="rgba(99,102,241,0.5)" strokeWidth="1.5" />
    <path d="M190 36l2.5 7.5H207l-6.3 4.5 2.4 7.5-6.3-4.5-6.3 4.5 2.4-7.5-6.3-4.5h14.5z" fill="url(#gReq)" />

    {/* Floating cards */}
    <g opacity="0.85">
      <rect x="20" y="110" width="88" height="60" rx="12" fill="rgba(20,184,166,0.12)" stroke="rgba(20,184,166,0.35)" strokeWidth="1.5" />
      <rect x="32" y="124" width="44" height="5" rx="2.5" fill="rgba(20,184,166,0.7)" />
      <rect x="32" y="134" width="64" height="3.5" rx="1.75" fill="rgba(255,255,255,0.2)" />
      <rect x="32" y="142" width="50" height="3.5" rx="1.75" fill="rgba(255,255,255,0.15)" />
      <circle cx="96" cy="155" r="7" fill="url(#gTeal)" opacity="0.7" />
    </g>

    <g opacity="0.85">
      <rect x="272" y="100" width="88" height="60" rx="12" fill="rgba(168,85,247,0.12)" stroke="rgba(168,85,247,0.35)" strokeWidth="1.5" />
      <rect x="284" y="114" width="44" height="5" rx="2.5" fill="rgba(168,85,247,0.7)" />
      <rect x="284" y="124" width="64" height="3.5" rx="1.75" fill="rgba(255,255,255,0.2)" />
      <rect x="284" y="132" width="40" height="3.5" rx="1.75" fill="rgba(255,255,255,0.15)" />
      <circle cx="348" cy="144" r="7" fill="rgba(34,197,94,0.7)" />
    </g>

    {/* Sparkles */}
    <path d="M50 60l2 5 5 2-5 2-2 5-2-5-5-2 5-2z" fill="rgba(99,102,241,0.6)" />
    <path d="M320 220l1.5 3.5 3.5 1.5-3.5 1.5-1.5 3.5-1.5-3.5-3.5-1.5 3.5-1.5z" fill="rgba(168,85,247,0.6)" />
    <path d="M340 60l1.5 3.5 3.5 1.5-3.5 1.5-1.5 3.5-1.5-3.5-3.5-1.5 3.5-1.5z" fill="rgba(99,102,241,0.5)" />
    <path d="M60 230l1 2.5 2.5 1-2.5 1-1 2.5-1-2.5-2.5-1 2.5-1z" fill="rgba(20,184,166,0.5)" />
  </svg>
);

/* ── Password strength ── */
const STRENGTH_LABELS = ["", "Weak", "Fair", "Good", "Strong"];
const STRENGTH_CLASSES = ["", "weak", "fair", "good", "strong"];
const BAR_CLASSES = ["", "active-weak", "active-fair", "active-good", "active-strong"];

function getStrength(pw) {
  let score = 0;
  if (!pw) return 0;
  if (pw.length >= 8) score++;
  if (/[A-Z]/.test(pw)) score++;
  if (/[0-9]/.test(pw)) score++;
  if (/[^A-Za-z0-9]/.test(pw)) score++;
  return score;
}

function PasswordStrength({ password }) {
  const score = getStrength(password);
  if (!password) return null;
  return (
    <div className="pw-strength">
      <div className="pw-strength-bars">
        {[1, 2, 3, 4].map((i) => (
          <div
            key={i}
            className={`pw-bar${i <= score ? ` ${BAR_CLASSES[score]}` : ""}`}
          />
        ))}
      </div>
      <span className={`pw-strength-label ${STRENGTH_CLASSES[score]}`}>
        {STRENGTH_LABELS[score]}
      </span>
    </div>
  );
}

/* ── Validation ── */
function validate(form) {
  const errors = {};
  if (!form.fullName.trim()) errors.fullName = "Full name is required.";
  if (!form.email.trim()) errors.email = "Email is required.";
  else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email))
    errors.email = "Enter a valid email address.";
  if (!form.password) errors.password = "Password is required.";
  else if (form.password.length < 8) errors.password = "Password must be at least 8 characters.";
  if (!form.confirmPassword) errors.confirmPassword = "Please confirm your password.";
  else if (form.password !== form.confirmPassword) errors.confirmPassword = "Passwords do not match.";
  if (!form.role) errors.role = "Please select a role.";
  if (!form.phone.trim()) errors.phone = "Phone number is required.";
  if (!form.terms) errors.terms = "You must accept the Terms & Conditions.";
  return errors;
}

const ROLE_OPTIONS = [
  { value: "candidate", label: "Candidate" },
  { value: "recruiter", label: "Recruiter" },
  { value: "admin",     label: "Admin" },
];

export default function SignupPage() {
  const navigate = useNavigate();
  const [form, setForm] = useState({
    fullName: "", email: "", password: "", confirmPassword: "",
    role: "", phone: "", location: "", currentRole: "", experience: "", targetRole: "",
    profileImage: null,
  });
  const [errors, setErrors] = useState({});
  const [apiError, setApiError] = useState("");
  const [terms, setTerms] = useState(false);
  const [privacy, setPrivacy] = useState(false);
  const [loading, setLoading] = useState(false);

  const set = (field) => (e) =>
    setForm((f) => ({ ...f, [field]: e.target.value }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    const errs = validate({ ...form, terms });
    if (Object.keys(errs).length) {
      setErrors(errs);
      return;
    }
    setErrors({});
    setApiError("");
    setLoading(true);
    try {
      await signupApi({
        fullName: form.fullName,
        email: form.email,
        password: form.password,
        role: form.role,
        phone: form.phone,
        location: form.location,
        currentRole: form.currentRole,
        experience: form.experience,
        targetRole: form.targetRole,
      });
      navigate("/verify-otp", { state: { email: form.email, flow: "signup" } });
    } catch (err) {
      const msg =
        err?.response?.data?.message ||
        "Signup failed. Please try again.";
      setApiError(msg);
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleLogin = async (googleData) => {
    setLoading(true);
    setApiError("");
    try {
      const data = await googleLoginApi({ ...googleData, signUpIfNotFound: true });
      
      // Default to persistent storage for registration
      localStorage.setItem("truehire_token", data.token);
      localStorage.setItem("truehire_user", JSON.stringify(data.user));
      localStorage.setItem("truehire_remember", "true");
      localStorage.setItem("truehire_remember_email", data.user.email);
      
      sessionStorage.removeItem("truehire_token");
      sessionStorage.removeItem("truehire_user");
      
      navigate("/home", { replace: true });
    } catch (err) {
      const msg = err?.response?.data?.message || "Google authentication failed. Please try again.";
      setApiError(msg);
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

        const btnContainer = document.getElementById("google-signup-btn-container");
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
        <RecruitIllustration />
      </div>
      <h1 className="auth-left-heading">
        Create Your <span>TrueHire</span> Account
      </h1>
      <p className="auth-left-subtitle">
        Join thousands of professionals finding their dream opportunities.
      </p>
      <div className="auth-left-badges">
        <span className="auth-badge"><span className="auth-badge-dot" /><Rocket size={12} />Fast Onboarding</span>
        <span className="auth-badge"><span className="auth-badge-dot" /><Award size={12} />Verified Profiles</span>
        <span className="auth-badge"><span className="auth-badge-dot" /><Star size={12} />Top Companies</span>
      </div>
    </div>
  );

  return (
    <AuthLayout left={leftPanel}>
      <h2 className="auth-card-title">Create Account</h2>
      <p className="auth-card-subtitle">Start your journey with TrueHire today</p>

      <form className="auth-form" onSubmit={handleSubmit} noValidate id="signup-form">

        {/* — Basic Info — */}
        <p className="signup-section-label">Basic Info</p>

        <div className="signup-grid-2">
          <InputField
            label="Full Name"
            type="text"
            placeholder="Jane Doe"
            value={form.fullName}
            onChange={set("fullName")}
            error={errors.fullName}
            icon={User}
          />
          <InputField
            label="Email Address"
            type="email"
            placeholder="you@example.com"
            value={form.email}
            onChange={set("email")}
            error={errors.email}
            icon={Mail}
          />
        </div>

        <div className="signup-grid-2">
          <div>
            <InputField
              label="Password"
              type="password"
              placeholder="Min. 8 characters"
              value={form.password}
              onChange={set("password")}
              error={errors.password}
              icon={Lock}
            />
            <PasswordStrength password={form.password} />
          </div>
          <InputField
            label="Confirm Password"
            type="password"
            placeholder="Repeat password"
            value={form.confirmPassword}
            onChange={set("confirmPassword")}
            error={errors.confirmPassword}
            icon={Lock}
          />
        </div>

        <div className="signup-section-divider" />
        <p className="signup-section-label">Profile</p>

        <div className="signup-grid-2">
          <InputField
            label="Role"
            type="select"
            value={form.role}
            onChange={set("role")}
            error={errors.role}
            icon={Briefcase}
            options={ROLE_OPTIONS}
          />
          <InputField
            label="Phone Number"
            type="tel"
            placeholder="+1 (555) 000-0000"
            value={form.phone}
            onChange={set("phone")}
            error={errors.phone}
            icon={Phone}
          />
        </div>

        <InputField
          label="Profile Image"
          type="file"
          placeholder="Upload profile photo"
        />

        <div className="signup-grid-2">
          <InputField
            label="Location"
            type="text"
            placeholder="City, Country"
            value={form.location}
            onChange={set("location")}
            icon={MapPin}
          />
          <InputField
            label="Current Role"
            type="text"
            placeholder="e.g. Software Engineer"
            value={form.currentRole}
            onChange={set("currentRole")}
            icon={Briefcase}
          />
        </div>

        <div className="signup-grid-2">
          <InputField
            label="Years of Experience"
            type="number"
            placeholder="e.g. 3"
            value={form.experience}
            onChange={set("experience")}
            icon={TrendingUp}
          />
          <InputField
            label="Target Role"
            type="text"
            placeholder="e.g. Senior Engineer"
            value={form.targetRole}
            onChange={set("targetRole")}
            icon={Target}
          />
        </div>

        <div className="signup-section-divider" />

        {/* Terms checkboxes */}
        <div className="signup-checks">
          <label className="signup-checkbox-label" htmlFor="terms-check">
            <input
              id="terms-check"
              type="checkbox"
              checked={terms}
              onChange={(e) => setTerms(e.target.checked)}
            />
            I agree to the <a href="#" onClick={(e) => e.preventDefault()}>Terms &amp; Conditions</a>
          </label>
          {errors.terms && (
            <span style={{ color: "#ef4444", fontSize: "0.78rem" }}>{errors.terms}</span>
          )}
          <label className="signup-checkbox-label" htmlFor="privacy-check">
            <input
              id="privacy-check"
              type="checkbox"
              checked={privacy}
              onChange={(e) => setPrivacy(e.target.checked)}
            />
            I acknowledge the <a href="#" onClick={(e) => e.preventDefault()}>Privacy Policy</a>
          </label>
        </div>

        {apiError && (
          <div className="auth-api-error">{apiError}</div>
        )}

        <Button type="submit" variant="primary" loading={loading} id="create-account-btn">
          Create Account
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
            ℹ️ Configure <code>VITE_GOOGLE_CLIENT_ID</code> in the frontend <code>.env</code> file to enable Google signup.
          </div>
        ) : (
          <div id="google-signup-btn-container" style={{ width: "100%", display: "flex", justifyContent: "center" }}></div>
        )}
      </form>

      <p className="auth-bottom">
        Already have an account?{" "}
        <Link to="/login" id="signin-link">Sign In</Link>
      </p>
    </AuthLayout>
  );
}
