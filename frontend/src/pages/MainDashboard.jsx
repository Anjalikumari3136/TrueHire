import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { getDashboard, getMe } from "../services/dashboardApi";
import { downloadReportPdf } from "../services/oaApi";
import { getProgress, ROUND_ORDER } from "../services/roundProgress";
import { timeAgo } from "../utils/timeAgo";
import NotificationsMenu, { notifUnreadCount } from "../components/NotificationsMenu";

/**
 * Main Dashboard (/home) — the new post-login landing page.
 *
 * A professional, dynamic SaaS dashboard. Every value comes from the logged-in
 * user's own database records (via GET /api/dashboard + /api/auth/me) — no fake
 * or hardcoded data. "Start / Resume Interview" navigates to the existing
 * /dashboard interview flow, which is left completely untouched.
 */

// ── Small helpers ────────────────────────────────────────────────────────────
function greetingWord() {
  const h = new Date().getHours();
  if (h < 12) return "Good Morning";
  if (h < 18) return "Good Afternoon";
  return "Good Evening";
}

function scoreColor(score) {
  const n = Number(score) || 0;
  if (n >= 75) return "#22c55e";
  if (n >= 50) return "#f59e0b";
  return "#ef4444";
}

function formatDate(value) {
  if (!value) return "—";
  try {
    return new Date(value).toLocaleDateString(undefined, {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  } catch {
    return "—";
  }
}

function initials(name = "") {
  return (
    name
      .trim()
      .split(/\s+/)
      .slice(0, 2)
      .map((p) => p[0]?.toUpperCase())
      .join("") || "U"
  );
}

// ── Reusable presentational pieces ───────────────────────────────────────────
function StatCard({ label, value, accent = "var(--color-brand-400)", hint }) {
  return (
    <div className="glass-strong rounded-2xl p-5">
      <p className="text-xs uppercase tracking-wider text-text-muted mb-2">{label}</p>
      <p className="text-3xl font-extrabold text-text-primary" style={{ color: accent }}>
        {value}
      </p>
      {hint && <p className="text-xs text-text-muted mt-1">{hint}</p>}
    </div>
  );
}

function Ring({ percent = 0, label, color = "var(--color-brand-400)", display }) {
  const p = Math.max(0, Math.min(100, Number(percent) || 0));
  const r = 34;
  const c = 2 * Math.PI * r;
  return (
    <div className="flex flex-col items-center gap-2">
      <div className="relative w-24 h-24">
        <svg className="w-full h-full -rotate-90" viewBox="0 0 84 84">
          <circle cx="42" cy="42" r={r} fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth="7" />
          <circle
            cx="42"
            cy="42"
            r={r}
            fill="none"
            stroke={color}
            strokeWidth="7"
            strokeLinecap="round"
            strokeDasharray={c}
            strokeDashoffset={c * (1 - p / 100)}
            style={{ transition: "stroke-dashoffset 1s ease-out" }}
          />
        </svg>
        <div className="absolute inset-0 flex items-center justify-center">
          <span className="text-lg font-bold text-text-primary">{display ?? `${Math.round(p)}%`}</span>
        </div>
      </div>
      <span className="text-xs text-text-secondary text-center">{label}</span>
    </div>
  );
}

// ── Main component ───────────────────────────────────────────────────────────
export default function MainDashboard() {
  const navigate = useNavigate();
  const [status, setStatus] = useState("loading"); // loading | error | ready
  const [data, setData] = useState(null);
  const [me, setMe] = useState(null);
  const [errorMsg, setErrorMsg] = useState("");
  const [downloadingId, setDownloadingId] = useState(null);
  const [notifOpen, setNotifOpen] = useState(false);
  const [readVersion, setReadVersion] = useState(0);

  const load = useCallback(async () => {
    setStatus("loading");
    setErrorMsg("");
    try {
      const [dash, user] = await Promise.all([getDashboard(), getMe().catch(() => null)]);
      setData(dash);
      setMe(user);
      setStatus("ready");
    } catch (err) {
      setErrorMsg(err.response?.data?.message || err.message || "Unable to load dashboard.");
      setStatus("error");
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  // Real-time updates: silently refetch when the user returns to the tab/window,
  // so completing an interview / downloading a report reflects without a manual
  // refresh. A lightweight background refetch (no loading spinner).
  useEffect(() => {
    const refetch = async () => {
      try {
        const [dash, user] = await Promise.all([getDashboard(), getMe().catch(() => null)]);
        setData(dash);
        if (user) setMe(user);
      } catch {
        /* ignore transient refetch errors */
      }
    };
    const onFocus = () => refetch();
    const onVisible = () => {
      if (document.visibilityState === "visible") refetch();
    };
    window.addEventListener("focus", onFocus);
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      window.removeEventListener("focus", onFocus);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, []);

  const handleLogout = useCallback(() => {
    localStorage.removeItem("truehire_token");
    localStorage.removeItem("truehire_user");
    sessionStorage.removeItem("truehire_token");
    sessionStorage.removeItem("truehire_user");
    navigate("/login");
  }, [navigate]);

  const handleDownload = useCallback(async (interviewId) => {
    setDownloadingId(interviewId || "latest");
    try {
      await downloadReportPdf(interviewId);
    } catch {
      /* surfaced inline elsewhere; keep dashboard resilient */
    } finally {
      setDownloadingId(null);
    }
  }, []);

  const unreadCount = useMemo(
    () => notifUnreadCount(data?.recent_activity || []),
    [data, readVersion]
  );

  // Enrich the active interview with the real client-side round progress.
  const activeRound = useMemo(() => {
    if (!data?.active_interview) return null;
    const progress = getProgress();
    const doneCount = ROUND_ORDER.filter((r) => progress[r]).length;
    const current = ROUND_ORDER.find((r) => !progress[r]) || ROUND_ORDER[ROUND_ORDER.length - 1];
    return { current, percent: Math.round((doneCount / ROUND_ORDER.length) * 100) };
  }, [data]);

  // ── States ─────────────────────────────────────────────────────────────────
  if (status === "loading") {
    return (
      <div className="min-h-screen flex items-center justify-center px-4">
        <div className="text-center">
          <div className="relative w-16 h-16 mx-auto mb-5">
            <div className="absolute inset-0 rounded-full border-2 border-brand-500/20" />
            <div className="absolute inset-0 rounded-full border-2 border-transparent border-t-brand-500 animate-spin-slow" />
          </div>
          <p className="text-text-secondary text-sm">Loading your dashboard…</p>
        </div>
      </div>
    );
  }

  if (status === "error") {
    return (
      <div className="min-h-screen flex items-center justify-center px-4">
        <div className="text-center max-w-sm">
          <p className="text-error mb-4">{errorMsg}</p>
          <button
            onClick={load}
            className="py-2.5 px-6 rounded-xl font-semibold text-sm text-white bg-gradient-to-r from-brand-500 to-brand-600 cursor-pointer"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  const user = me || data.user || {};
  const stats = data.stats || {};
  const active = data.active_interview;
  const latest = data.latest_report;
  const displayName = user.name || data.user?.name || "there";

  return (
    <div className="min-h-screen px-4 sm:px-6 pt-6 pb-16">
      {/* Ambient background glow */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden -z-10">
        <div className="absolute top-[-20%] left-[-10%] w-[600px] h-[600px] rounded-full bg-brand-700/[0.07] blur-[120px]" />
        <div className="absolute bottom-[-20%] right-[-10%] w-[500px] h-[500px] rounded-full bg-brand-500/[0.05] blur-[100px]" />
      </div>

      <div className="max-w-6xl mx-auto animate-fade-in-up">
        {/* ── Header ── */}
        <header className="flex items-center justify-between gap-4 mb-8">
          <div className="flex items-center gap-3 min-w-0">
            {user.profileImageSignedUrl ? (
              <img
                src={user.profileImageSignedUrl}
                alt={displayName}
                className="w-11 h-11 rounded-full object-cover border border-white/10"
              />
            ) : (
              <div className="w-11 h-11 rounded-full bg-gradient-to-br from-brand-500 to-brand-600 flex items-center justify-center text-white font-bold text-sm">
                {initials(displayName)}
              </div>
            )}
            <div className="min-w-0">
              <p className="text-sm font-semibold text-text-primary truncate">{displayName}</p>
              <p className="text-xs text-text-muted truncate">{user.email || data.user?.email}</p>
            </div>
          </div>

          <div className="flex items-center gap-1.5">
            {/* Notifications — polished dropdown of the latest real activity */}
            <div className="relative">
              <button
                onClick={() => setNotifOpen((o) => !o)}
                title="Notifications"
                className="relative w-9 h-9 rounded-xl glass flex items-center justify-center text-text-secondary hover:text-text-primary transition-colors cursor-pointer"
              >
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.8"><path strokeLinecap="round" strokeLinejoin="round" d="M15 17h5l-1.4-1.4A2 2 0 0118 14.2V11a6 6 0 10-12 0v3.2a2 2 0 01-.6 1.4L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" /></svg>
                {unreadCount > 0 && (
                  <span className="absolute -top-1 -right-1 min-w-[16px] h-4 px-1 rounded-full bg-brand-500 text-white text-[10px] font-bold flex items-center justify-center leading-none">
                    {unreadCount > 9 ? "9+" : unreadCount}
                  </span>
                )}
              </button>
              {notifOpen && (
                <NotificationsMenu
                  items={data.recent_activity || []}
                  onClose={() => setNotifOpen(false)}
                  onReadChange={() => setReadVersion((v) => v + 1)}
                />
              )}
            </div>
            <button onClick={() => navigate("/settings")} title="Settings" className="w-9 h-9 rounded-xl glass flex items-center justify-center text-text-secondary hover:text-text-primary transition-colors cursor-pointer">
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.8"><path strokeLinecap="round" strokeLinejoin="round" d="M10.3 3.9a1.7 1.7 0 013.4 0l.1.7a1.7 1.7 0 002.5 1l.6-.3a1.7 1.7 0 012.3 2.3l-.3.6a1.7 1.7 0 001 2.5l.7.1a1.7 1.7 0 010 3.4l-.7.1a1.7 1.7 0 00-1 2.5l.3.6a1.7 1.7 0 01-2.3 2.3l-.6-.3a1.7 1.7 0 00-2.5 1l-.1.7a1.7 1.7 0 01-3.4 0l-.1-.7a1.7 1.7 0 00-2.5-1l-.6.3a1.7 1.7 0 01-2.3-2.3l.3-.6a1.7 1.7 0 00-1-2.5l-.7-.1a1.7 1.7 0 010-3.4l.7-.1a1.7 1.7 0 001-2.5l-.3-.6A1.7 1.7 0 016.9 5.3l.6.3a1.7 1.7 0 002.5-1l.3-.7z" /><circle cx="12" cy="12" r="3" /></svg>
            </button>
            <button onClick={handleLogout} title="Logout" className="w-9 h-9 rounded-xl glass flex items-center justify-center text-text-secondary hover:text-error transition-colors cursor-pointer">
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.8"><path strokeLinecap="round" strokeLinejoin="round" d="M15 12H3m0 0l4-4m-4 4l4 4m6-11h4a2 2 0 012 2v10a2 2 0 01-2 2h-4" /></svg>
            </button>
          </div>
        </header>

        {/* ── Greeting ── */}
        <div className="mb-8">
          <h1 className="text-2xl sm:text-3xl font-extrabold text-text-primary tracking-tight">
            {greetingWord()}, {displayName} 👋
          </h1>
          <p className="text-text-secondary text-sm mt-1">Ready for your next interview?</p>
        </div>

        {/* ── Top statistics cards ── */}
        <div className="grid grid-cols-2 lg:grid-cols-6 gap-4 mb-8">
          <StatCard label="Total Interviews" value={stats.total_interviews ?? 0} />
          <StatCard label="Completed" value={stats.completed_interviews ?? 0} accent="#22c55e" />
          <StatCard label="Active" value={stats.active_interview ?? 0} accent="#f59e0b" />
          <StatCard label="Average Score" value={stats.average_score ?? 0} accent={scoreColor(stats.average_score)} />
          <StatCard label="Highest Score" value={stats.highest_score ?? 0} accent={scoreColor(stats.highest_score)} />
          <StatCard label="Reports" value={stats.reports_generated ?? 0} />
        </div>

        <div className="grid lg:grid-cols-3 gap-6 mb-8">
          {/* ── Active interview / start new ── */}
          <div className="lg:col-span-2 glass-strong rounded-2xl p-6">
            {active ? (
              <>
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-sm font-semibold text-text-primary">Active Interview</h2>
                  <span className="text-xs px-2.5 py-1 rounded-md font-semibold text-unverified border border-unverified/40 bg-unverified/10">
                    {active.status}
                  </span>
                </div>
                <div className="grid sm:grid-cols-2 gap-4 mb-5">
                  <div>
                    <p className="text-xs text-text-muted">Resume</p>
                    <p className="text-sm text-text-primary font-medium truncate">{active.resume_name || "—"}</p>
                  </div>
                  <div>
                    <p className="text-xs text-text-muted">Current Round</p>
                    <p className="text-sm text-text-primary font-medium">{activeRound?.current || "OA"}</p>
                  </div>
                  <div>
                    <p className="text-xs text-text-muted">Started</p>
                    <p className="text-sm text-text-primary font-medium">{formatDate(active.started_at)}</p>
                  </div>
                  <div>
                    <p className="text-xs text-text-muted">Progress</p>
                    <p className="text-sm text-text-primary font-medium">{activeRound?.percent ?? 0}%</p>
                  </div>
                </div>
                <div className="w-full h-2 rounded-full bg-white/5 overflow-hidden mb-5">
                  <div
                    className="h-full bg-gradient-to-r from-brand-500 to-brand-400 transition-all duration-700"
                    style={{ width: `${activeRound?.percent ?? 0}%` }}
                  />
                </div>
                {/* Interview still pending → offer BOTH resume and start-new.
                    Resume reuses the previous résumé's analysis (no re-upload);
                    Start New goes to the upload flow for a fresh résumé. */}
                <div className="flex flex-col sm:flex-row gap-3">
                  <button
                    onClick={() => {
                      sessionStorage.setItem("truehire_resume", "1");
                      navigate("/dashboard");
                    }}
                    className="py-2.5 px-6 rounded-xl font-semibold text-sm text-white bg-gradient-to-r from-brand-500 to-brand-600 hover:from-brand-400 hover:to-brand-500 transition-all cursor-pointer"
                  >
                    Resume Interview
                  </button>
                  <button
                    onClick={() => {
                      sessionStorage.removeItem("truehire_resume");
                      navigate("/dashboard");
                    }}
                    className="py-2.5 px-6 rounded-xl font-semibold text-sm text-text-primary border border-white/10 hover:bg-white/5 transition-all cursor-pointer"
                  >
                    Start New Interview
                  </button>
                </div>
              </>
            ) : (
              <div className="text-center py-6">
                <h2 className="text-sm font-semibold text-text-primary mb-1">No Interview In Progress</h2>
                <p className="text-xs text-text-muted mb-6">Start a new interview to begin your assessment.</p>
                <button
                  onClick={() => {
                    sessionStorage.removeItem("truehire_resume");
                    navigate("/dashboard");
                  }}
                  className="py-3 px-8 rounded-xl font-semibold text-sm text-white bg-gradient-to-r from-brand-500 to-brand-600 hover:from-brand-400 hover:to-brand-500 shadow-[0_0_20px_rgba(99,102,241,0.2)] transition-all cursor-pointer"
                >
                  Start New Interview
                </button>
              </div>
            )}
          </div>

          {/* ── Progress rings ── */}
          <div className="glass-strong rounded-2xl p-6">
            <h2 className="text-sm font-semibold text-text-primary mb-4">Progress</h2>
            <div className="grid grid-cols-2 gap-4">
              <Ring percent={data.progress?.overall_success} label="Overall Success" color={scoreColor(data.progress?.overall_success)} />
              <Ring percent={data.progress?.completed_rounds_percent} label="Completed Rounds" color="var(--color-brand-400)" />
              <Ring percent={data.progress?.average_performance} label="Avg Performance" color={scoreColor(data.progress?.average_performance)} />
              <Ring percent={data.progress?.pending_interviews ? 100 : 0} display={String(data.progress?.pending_interviews ?? 0)} label="Pending" color="#f59e0b" />
            </div>
          </div>
        </div>

        {/* ── Recent history + Report summary ── */}
        <div className="grid lg:grid-cols-3 gap-6 mb-8">
          <div className="lg:col-span-2 glass-strong rounded-2xl p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-sm font-semibold text-text-primary">Recent Interview History</h2>
              <button onClick={() => navigate("/history")} className="text-xs text-brand-400 hover:text-brand-300 cursor-pointer">
                View All →
              </button>
            </div>
            {data.recent_interviews?.length ? (
              <div className="space-y-3">
                {data.recent_interviews.map((it) => (
                  <div key={it.interview_id} className="flex items-center justify-between gap-3 p-3 rounded-xl bg-white/[0.02] border border-white/5">
                    <div className="min-w-0">
                      <p className="text-sm text-text-primary font-medium truncate">{it.resume_name || "Interview"}</p>
                      <p className="text-xs text-text-muted">{formatDate(it.date)} · {it.status}</p>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <span className="text-xs px-2 py-0.5 rounded-md font-semibold border" style={{ color: scoreColor(it.overall_score), borderColor: `${scoreColor(it.overall_score)}55`, background: `${scoreColor(it.overall_score)}1a` }}>
                        {Math.round(it.overall_score ?? 0)}/100
                      </span>
                      <button onClick={() => navigate(`/dashboard/report/${it.interview_id}`)} className="text-xs px-2.5 py-1 rounded-md text-text-secondary hover:text-text-primary border border-white/10 cursor-pointer">
                        View
                      </button>
                      {it.pdf_available && (
                        <button onClick={() => handleDownload(it.interview_id)} disabled={downloadingId === it.interview_id} className="text-xs px-2.5 py-1 rounded-md text-brand-300 hover:text-brand-200 border border-brand-500/30 cursor-pointer disabled:opacity-50">
                          {downloadingId === it.interview_id ? "…" : "PDF"}
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-xs text-text-muted italic py-6 text-center">No interviews yet. Start your first interview to see it here.</p>
            )}
          </div>

          {/* Latest report summary */}
          <div className="glass-strong rounded-2xl p-6">
            <h2 className="text-sm font-semibold text-text-primary mb-4">Latest Report</h2>
            {latest ? (
              <div className="space-y-3">
                <div>
                  <p className="text-xs text-text-muted">Overall Score</p>
                  <p className="text-2xl font-extrabold" style={{ color: scoreColor(latest.overall_score) }}>{Math.round(latest.overall_score ?? 0)}/100</p>
                </div>
                <div>
                  <p className="text-xs text-text-muted">Hiring Recommendation</p>
                  <p className="text-sm text-text-primary font-medium">{latest.hiring_recommendation || "—"}</p>
                </div>
                <div>
                  <p className="text-xs text-text-muted">Generated</p>
                  <p className="text-sm text-text-primary font-medium">{formatDate(latest.generated_at)}</p>
                </div>
                <div className="flex gap-2 pt-2">
                  <button onClick={() => navigate(`/dashboard/report/${latest.interview_id}`)} className="flex-1 py-2 rounded-xl text-xs font-semibold text-white bg-gradient-to-r from-brand-500 to-brand-600 cursor-pointer">
                    View Report
                  </button>
                  {latest.pdf_available && (
                    <button onClick={() => handleDownload(latest.interview_id)} disabled={downloadingId === latest.interview_id} className="flex-1 py-2 rounded-xl text-xs font-semibold text-text-primary border border-white/10 cursor-pointer disabled:opacity-50">
                      {downloadingId === latest.interview_id ? "…" : "Download PDF"}
                    </button>
                  )}
                </div>
              </div>
            ) : (
              <p className="text-xs text-text-muted italic py-6 text-center">No report yet.</p>
            )}
          </div>
        </div>

        {/* ── AI Insights ── */}
        {data.ai_insights?.length > 0 && (
          <div className="glass-strong rounded-2xl p-6 mb-8">
            <h2 className="text-sm font-semibold text-text-primary mb-4">AI Insights</h2>
            <div className="grid sm:grid-cols-2 gap-3">
              {data.ai_insights.map((ins, i) => (
                <div key={i} className="flex items-center gap-2.5 p-3 rounded-xl bg-white/[0.02] border border-white/5">
                  <span className={`w-2 h-2 rounded-full shrink-0 ${ins.type === "positive" ? "bg-verified" : "bg-unverified"}`} />
                  <span className="text-sm text-text-secondary">{ins.text}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ── Quick actions (each card opens its own page) ── */}
        <div className="mb-8">
          <h2 className="text-sm font-semibold text-text-primary mb-4">Quick Actions</h2>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
            {[
              { label: "Interview History", to: "/history" },
              { label: "Reports", to: "/reports" },
              { label: "Profile", to: "/profile" },
              { label: "Settings", to: "/settings" },
              { label: "Recent Activity", to: "/activity" },
            ].map((a) => (
              <button
                key={a.label}
                onClick={() => navigate(a.to)}
                className="glass-strong rounded-2xl p-5 text-left hover:border-brand-500/30 transition-colors cursor-pointer"
              >
                <p className="text-sm font-semibold text-text-primary">{a.label}</p>
              </button>
            ))}
          </div>
        </div>

        {/* ── Profile summary + Recent activity ── */}
        <div className="grid lg:grid-cols-2 gap-6">
          <div className="glass-strong rounded-2xl p-6">
            <h2 className="text-sm font-semibold text-text-primary mb-4">Profile Summary</h2>
            <div className="flex items-center gap-4 mb-4">
              {user.profileImageSignedUrl ? (
                <img src={user.profileImageSignedUrl} alt={displayName} className="w-14 h-14 rounded-full object-cover border border-white/10" />
              ) : (
                <div className="w-14 h-14 rounded-full bg-gradient-to-br from-brand-500 to-brand-600 flex items-center justify-center text-white font-bold">
                  {initials(displayName)}
                </div>
              )}
              <div className="min-w-0">
                <p className="text-sm font-semibold text-text-primary truncate">{displayName}</p>
                <p className="text-xs text-text-muted truncate">{user.email || data.user?.email}</p>
              </div>
            </div>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between"><span className="text-text-muted">Member Since</span><span className="text-text-secondary">{formatDate(data.profile?.member_since)}</span></div>
              {data.user?.github && <div className="flex justify-between"><span className="text-text-muted">GitHub</span><span className="text-text-secondary">{data.user.github}</span></div>}
              {data.user?.current_role && <div className="flex justify-between"><span className="text-text-muted">Current Role</span><span className="text-text-secondary">{data.user.current_role}</span></div>}
              {data.user?.target_role && <div className="flex justify-between"><span className="text-text-muted">Target Role</span><span className="text-text-secondary">{data.user.target_role}</span></div>}
            </div>

            {/* Profile completion */}
            <div className="mt-5">
              <div className="flex justify-between text-xs mb-1.5">
                <span className="text-text-muted">Profile Completion</span>
                <span className="text-text-secondary font-semibold">{data.user?.profile_completion ?? 0}%</span>
              </div>
              <div className="w-full h-2 rounded-full bg-white/5 overflow-hidden">
                <div className="h-full bg-gradient-to-r from-brand-500 to-brand-400 transition-all duration-700" style={{ width: `${data.user?.profile_completion ?? 0}%` }} />
              </div>
              {(data.user?.profile_completion ?? 0) < 100 && (
                <button onClick={() => navigate("/profile")} className="text-xs text-brand-400 hover:text-brand-300 mt-2 cursor-pointer">
                  Complete your profile →
                </button>
              )}
            </div>
          </div>

          <div className="glass-strong rounded-2xl p-6">
            <h2 className="text-sm font-semibold text-text-primary mb-4">Recent Activity</h2>
            {data.recent_activity?.length ? (
              <ul className="space-y-4">
                {data.recent_activity.map((ev, i) => (
                  <li key={i} className="flex gap-3">
                    <div className="flex flex-col items-center">
                      <span className="w-2.5 h-2.5 rounded-full bg-brand-500 mt-1.5" />
                      {i < data.recent_activity.length - 1 && <span className="flex-1 w-px bg-white/10 my-1" />}
                    </div>
                    <div className="pb-1">
                      <p className="text-sm text-text-primary">{ev.label}</p>
                      <p className="text-xs text-text-muted">{timeAgo(ev.timestamp)}</p>
                    </div>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-xs text-text-muted italic py-6 text-center">No activity yet.</p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
