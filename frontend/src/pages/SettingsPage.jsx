import { useCallback, useState } from "react";
import { useNavigate } from "react-router-dom";
import { changePassword } from "../services/dashboardApi";
import { useAccent } from "../context/AccentContext";

/**
 * Settings page (/settings).
 *
 * Sections:
 *   • Appearance    — Theme (Light/Dark) + Dashboard Accent Color
 *   • Notifications — Email / Report Ready / Interview Completion (client prefs)
 *   • Account       — Edit Profile, Change Password, Logout
 *
 * Theme + accent are managed by AccentContext (persisted per-user in the DB via
 * PUT /api/auth/preferences, with a localStorage fallback) and apply instantly
 * to the dashboard only — no page reload.
 */

function useLocalPref(key, fallback) {
  const [value, setValue] = useState(() => {
    const v = localStorage.getItem(key);
    return v === null ? fallback : v === "true";
  });
  const toggle = () => {
    setValue((prev) => {
      const next = !prev;
      localStorage.setItem(key, String(next));
      return next;
    });
  };
  return [value, toggle];
}

function Toggle({ label, hint, checked, onChange }) {
  return (
    <div className="flex items-center justify-between py-3">
      <div>
        <p className="text-sm text-text-primary">{label}</p>
        {hint && <p className="text-xs text-text-muted mt-0.5">{hint}</p>}
      </div>
      <button
        onClick={onChange}
        className={`relative w-11 h-6 rounded-full transition-colors cursor-pointer ${checked ? "bg-brand-500" : "bg-white/10"}`}
      >
        <span className={`absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white transition-transform ${checked ? "translate-x-5" : ""}`} />
      </button>
    </div>
  );
}

function Section({ title, children }) {
  return (
    <div className="glass-strong rounded-2xl p-6">
      <h2 className="text-sm font-semibold text-text-primary mb-4">{title}</h2>
      {children}
    </div>
  );
}

export default function SettingsPage() {
  const navigate = useNavigate();
  const { accent, setAccent, ACCENTS, theme, setTheme } = useAccent();

  const [emailNotif, toggleEmailNotif] = useLocalPref("truehire_pref_email_notifications", true);
  const [reportEmails, toggleReportEmails] = useLocalPref("truehire_pref_report_emails", true);
  const [completionEmails, toggleCompletionEmails] = useLocalPref("truehire_pref_completion_emails", true);

  const [pw, setPw] = useState({ currentPassword: "", newPassword: "", confirm: "" });
  const [pwMsg, setPwMsg] = useState(null);
  const [saving, setSaving] = useState(false);

  const handleChangePassword = useCallback(async () => {
    setPwMsg(null);
    if (!pw.currentPassword || !pw.newPassword) {
      setPwMsg({ type: "error", text: "Please fill in both password fields." });
      return;
    }
    if (pw.newPassword.length < 8) {
      setPwMsg({ type: "error", text: "New password must be at least 8 characters." });
      return;
    }
    if (pw.newPassword !== pw.confirm) {
      setPwMsg({ type: "error", text: "New passwords do not match." });
      return;
    }
    setSaving(true);
    try {
      await changePassword({ currentPassword: pw.currentPassword, newPassword: pw.newPassword });
      setPwMsg({ type: "success", text: "Password updated successfully." });
      setPw({ currentPassword: "", newPassword: "", confirm: "" });
    } catch (err) {
      setPwMsg({ type: "error", text: err.response?.data?.message || "Failed to update password." });
    } finally {
      setSaving(false);
    }
  }, [pw]);

  const handleLogout = useCallback(() => {
    localStorage.removeItem("truehire_token");
    localStorage.removeItem("truehire_user");
    sessionStorage.removeItem("truehire_token");
    sessionStorage.removeItem("truehire_user");
    navigate("/login");
  }, [navigate]);

  const pwField = (label, key) => (
    <div>
      <label className="block text-xs uppercase tracking-wider text-text-muted mb-1.5">{label}</label>
      <input
        type="password"
        value={pw[key]}
        onChange={(e) => setPw((p) => ({ ...p, [key]: e.target.value }))}
        className="w-full px-3.5 py-2.5 rounded-xl bg-white/[0.03] border border-white/10 text-sm text-text-primary focus:outline-none focus:border-brand-500/50 transition-colors"
      />
    </div>
  );

  const THEME_OPTIONS = [
    { id: "light", label: "Light", icon: "M12 3v1m0 16v1m9-9h-1M4 12H3m15.36 6.36l-.7-.7M6.34 6.34l-.7-.7m12.72 0l-.7.7M6.34 17.66l-.7.7M16 12a4 4 0 11-8 0 4 4 0 018 0z" },
    { id: "dark", label: "Dark", icon: "M21 12.79A9 9 0 1111.21 3 7 7 0 0021 12.79z" },
  ];

  return (
    <div className="min-h-screen px-4 sm:px-6 pt-6 pb-16">
      <div className="fixed inset-0 pointer-events-none overflow-hidden -z-10">
        <div className="absolute top-[-20%] left-[-10%] w-[600px] h-[600px] rounded-full bg-brand-700/[0.07] blur-[120px]" />
      </div>

      <div className="max-w-2xl mx-auto animate-fade-in-up space-y-6">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-extrabold text-text-primary tracking-tight">Settings</h1>
          <button onClick={() => navigate("/home")} className="text-xs px-3 py-2 rounded-xl text-text-secondary border border-white/10 hover:bg-white/5 cursor-pointer">← Dashboard</button>
        </div>

        {/* ── Appearance ── */}
        <Section title="Appearance">
          {/* Theme */}
          <p className="text-xs uppercase tracking-wider text-text-muted mb-2">Theme</p>
          <div className="flex gap-2.5 mb-6">
            {THEME_OPTIONS.map((t) => {
              const active = theme === t.id;
              return (
                <button
                  key={t.id}
                  onClick={() => setTheme(t.id)}
                  className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl border transition-all cursor-pointer ${
                    active ? "border-brand-500 bg-brand-500/10 text-text-primary" : "border-white/10 text-text-secondary hover:bg-white/5"
                  }`}
                >
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.8"><path strokeLinecap="round" strokeLinejoin="round" d={t.icon} /></svg>
                  <span className="text-sm font-medium">{t.label} Mode</span>
                </button>
              );
            })}
          </div>

          {/* Accent color */}
          <p className="text-xs uppercase tracking-wider text-text-muted mb-2">Dashboard Accent Color</p>
          <div className="flex flex-wrap gap-3">
            {ACCENTS.map((c) => {
              const active = accent === c.id;
              return (
                <button
                  key={c.id}
                  onClick={() => setAccent(c.id)}
                  className={`flex items-center gap-2.5 pl-2.5 pr-4 py-2 rounded-xl border transition-all cursor-pointer ${
                    active ? "border-brand-500 bg-brand-500/10" : "border-white/10 hover:bg-white/5"
                  }`}
                >
                  <span className="w-5 h-5 rounded-full border border-white/20" style={{ background: c.swatch }} />
                  <span className="text-sm text-text-primary">
                    {c.label}
                    {c.id === "purple" ? " (Default)" : ""}
                  </span>
                  {active && (
                    <svg className="w-4 h-4 text-brand-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                    </svg>
                  )}
                </button>
              );
            })}
          </div>
        </Section>

        {/* ── Notifications ── */}
        <Section title="Notifications">
          <div className="divide-y divide-white/5">
            <Toggle label="Email Notifications" hint="Receive email updates from TrueHire" checked={emailNotif} onChange={toggleEmailNotif} />
            <Toggle label="Report Ready Emails" hint="Get emailed when your report PDF is ready" checked={reportEmails} onChange={toggleReportEmails} />
            <Toggle label="Interview Completion Emails" hint="Get emailed when an interview completes" checked={completionEmails} onChange={toggleCompletionEmails} />
          </div>
        </Section>

        {/* ── Account ── */}
        <Section title="Account">
          <div className="divide-y divide-white/5">
            <div className="flex items-center justify-between py-3">
              <div>
                <p className="text-sm text-text-primary">Edit Profile</p>
                <p className="text-xs text-text-muted mt-0.5">Update your name, avatar, GitHub and more.</p>
              </div>
              <button onClick={() => navigate("/profile")} className="text-xs px-4 py-2 rounded-xl text-text-primary border border-white/10 hover:bg-white/5 cursor-pointer">
                Edit Profile
              </button>
            </div>

            <div className="py-4">
              <p className="text-sm text-text-primary mb-3">Change Password</p>
              <div className="space-y-4">
                {pwField("Current Password", "currentPassword")}
                {pwField("New Password", "newPassword")}
                {pwField("Confirm New Password", "confirm")}
                {pwMsg && <p className={`text-xs ${pwMsg.type === "success" ? "text-verified" : "text-error"}`}>{pwMsg.text}</p>}
                <button
                  onClick={handleChangePassword}
                  disabled={saving}
                  className="py-2.5 px-6 rounded-xl font-semibold text-sm text-white bg-gradient-to-r from-brand-500 to-brand-600 hover:from-brand-400 hover:to-brand-500 transition-all cursor-pointer disabled:opacity-50"
                >
                  {saving ? "Updating…" : "Update Password"}
                </button>
              </div>
            </div>

            <div className="flex items-center justify-between py-3">
              <div>
                <p className="text-sm text-text-primary">Logout</p>
                <p className="text-xs text-text-muted mt-0.5">Sign out of your TrueHire account.</p>
              </div>
              <button onClick={handleLogout} className="py-2 px-5 rounded-xl font-semibold text-sm text-error border border-error/30 hover:bg-error/10 transition-all cursor-pointer">
                Logout
              </button>
            </div>
          </div>
        </Section>
      </div>
    </div>
  );
}
