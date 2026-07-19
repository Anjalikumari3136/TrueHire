import { useCallback, useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { getMe, updateProfile, uploadAvatar } from "../services/dashboardApi";

/**
 * Profile page (/profile) — editable.
 *
 * Lets the user update avatar, full name, GitHub, LinkedIn, College and Bio,
 * persisting to the database via the existing /api/auth/profile and
 * /api/auth/avatar endpoints. Saved values reflect on the dashboard (which
 * refetches on focus, and we also refresh the cached truehire_user).
 */

function initials(name = "") {
  return name.trim().split(/\s+/).slice(0, 2).map((p) => p[0]?.toUpperCase()).join("") || "U";
}

function persistUser(user) {
  const store = localStorage.getItem("truehire_token") ? localStorage : sessionStorage;
  const existing = JSON.parse(store.getItem("truehire_user") || "{}");
  store.setItem("truehire_user", JSON.stringify({ ...existing, ...user }));
}

export default function ProfilePage() {
  const navigate = useNavigate();
  const fileRef = useRef(null);
  const [status, setStatus] = useState("loading");
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState(null); // { type, text }
  const [avatarUrl, setAvatarUrl] = useState("");
  const [avatarFile, setAvatarFile] = useState(null);
  const [form, setForm] = useState({ name: "", email: "", github: "", linkedin: "", college: "", bio: "" });

  const load = useCallback(async () => {
    try {
      const u = await getMe();
      setForm({
        name: u.name || "",
        email: u.email || "",
        github: u.github || "",
        linkedin: u.linkedin || "",
        college: u.college || "",
        bio: u.bio || "",
      });
      setAvatarUrl(u.profileImageSignedUrl || "");
      setStatus("ready");
    } catch (err) {
      setMsg({ type: "error", text: err.response?.data?.message || "Failed to load profile." });
      setStatus("ready");
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const onField = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

  const onPickAvatar = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setAvatarFile(file);
    setAvatarUrl(URL.createObjectURL(file));
  };

  const handleSave = useCallback(async () => {
    setSaving(true);
    setMsg(null);
    try {
      if (avatarFile) {
        const updated = await uploadAvatar(avatarFile);
        if (updated?.profileImageSignedUrl) setAvatarUrl(updated.profileImageSignedUrl);
        persistUser(updated);
        setAvatarFile(null);
      }
      const user = await updateProfile(form);
      persistUser(user);
      setMsg({ type: "success", text: "Profile updated successfully." });
    } catch (err) {
      setMsg({ type: "error", text: err.response?.data?.message || err.message || "Failed to save profile." });
    } finally {
      setSaving(false);
    }
  }, [avatarFile, form]);

  if (status === "loading") {
    return <div className="min-h-screen flex items-center justify-center"><p className="text-text-secondary text-sm">Loading…</p></div>;
  }

  const field = (label, key, props = {}) => (
    <div>
      <label className="block text-xs uppercase tracking-wider text-text-muted mb-1.5">{label}</label>
      <input
        value={form[key]}
        onChange={onField(key)}
        className="w-full px-3.5 py-2.5 rounded-xl bg-white/[0.03] border border-white/10 text-sm text-text-primary placeholder:text-text-muted focus:outline-none focus:border-brand-500/50 transition-colors"
        {...props}
      />
    </div>
  );

  return (
    <div className="min-h-screen px-4 sm:px-6 pt-6 pb-16">
      <div className="fixed inset-0 pointer-events-none overflow-hidden -z-10">
        <div className="absolute top-[-20%] left-[-10%] w-[600px] h-[600px] rounded-full bg-brand-700/[0.07] blur-[120px]" />
      </div>

      <div className="max-w-2xl mx-auto animate-fade-in-up">
        <div className="flex items-center justify-between mb-8">
          <h1 className="text-2xl font-extrabold text-text-primary tracking-tight">Profile</h1>
          <button onClick={() => navigate("/home")} className="text-xs px-3 py-2 rounded-xl text-text-secondary border border-white/10 hover:bg-white/5 cursor-pointer">← Dashboard</button>
        </div>

        <div className="glass-strong rounded-2xl p-6 sm:p-8">
          {/* Avatar */}
          <div className="flex items-center gap-5 mb-8">
            {avatarUrl ? (
              <img src={avatarUrl} alt={form.name} className="w-20 h-20 rounded-full object-cover border border-white/10" />
            ) : (
              <div className="w-20 h-20 rounded-full bg-gradient-to-br from-brand-500 to-brand-600 flex items-center justify-center text-white font-bold text-xl">
                {initials(form.name)}
              </div>
            )}
            <div>
              <input ref={fileRef} type="file" accept="image/png,image/jpeg,image/webp" onChange={onPickAvatar} className="hidden" />
              <button onClick={() => fileRef.current?.click()} className="text-xs px-4 py-2 rounded-xl text-text-primary border border-white/10 hover:bg-white/5 cursor-pointer">
                Change Picture
              </button>
              <p className="text-xs text-text-muted mt-2">JPG, PNG or WEBP · max 2MB</p>
            </div>
          </div>

          <div className="grid sm:grid-cols-2 gap-4">
            {field("Full Name", "name")}
            <div>
              <label className="block text-xs uppercase tracking-wider text-text-muted mb-1.5">Email</label>
              <input value={form.email} disabled className="w-full px-3.5 py-2.5 rounded-xl bg-white/[0.02] border border-white/10 text-sm text-text-muted cursor-not-allowed" />
            </div>
            {field("GitHub Username", "github", { placeholder: "e.g. octocat" })}
            {field("LinkedIn", "linkedin", { placeholder: "profile URL or handle" })}
            {field("College", "college", { placeholder: "Your college / university" })}
          </div>

          <div className="mt-4">
            <label className="block text-xs uppercase tracking-wider text-text-muted mb-1.5">Bio</label>
            <textarea
              value={form.bio}
              onChange={onField("bio")}
              rows={3}
              placeholder="A short bio about yourself"
              className="w-full px-3.5 py-2.5 rounded-xl bg-white/[0.03] border border-white/10 text-sm text-text-primary placeholder:text-text-muted focus:outline-none focus:border-brand-500/50 transition-colors resize-none"
            />
          </div>

          {msg && (
            <p className={`text-xs mt-4 ${msg.type === "success" ? "text-verified" : "text-error"}`}>{msg.text}</p>
          )}

          <div className="flex gap-3 mt-6">
            <button
              onClick={handleSave}
              disabled={saving}
              className="py-2.5 px-8 rounded-xl font-semibold text-sm text-white bg-gradient-to-r from-brand-500 to-brand-600 hover:from-brand-400 hover:to-brand-500 transition-all cursor-pointer disabled:opacity-50"
            >
              {saving ? "Saving…" : "Save Changes"}
            </button>
            <button onClick={() => navigate("/home")} className="py-2.5 px-6 rounded-xl font-semibold text-sm text-text-primary border border-white/10 hover:bg-white/5 cursor-pointer">
              Cancel
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
