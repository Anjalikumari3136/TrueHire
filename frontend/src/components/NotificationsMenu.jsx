import { useCallback, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { timeAgo } from "../utils/timeAgo";

/**
 * NotificationsMenu — the polished notifications dropdown for the Main Dashboard.
 *
 * UI/UX only: renders the SAME real activity data (props.items) as modern,
 * color-coded, clickable cards. Read-state is tracked client-side in
 * localStorage (no backend / API changes). Each card navigates to the relevant
 * page. Fully theme-aware (see .notif-panel overrides in global.css).
 */

const READ_KEY = "truehire_notif_read";

// Per-type presentation + navigation. Unknown types fall back to a sensible default.
const TYPE_CONFIG = {
  report_generated: { title: "Report Generated", desc: "Your AI interview report is ready to view.", color: "#a855f7", to: () => "/reports" },
  report_email_sent: { title: "Report Emailed", desc: "Your report PDF has been sent to your registered email.", color: "#3b82f6", to: (m) => (m?.interviewId ? `/dashboard/report/${m.interviewId}` : "/reports") },
  report_downloaded: { title: "Report Downloaded", desc: "Your report PDF was downloaded.", color: "#60a5fa", to: () => "/reports" },
  interview_completed: { title: "Interview Completed", desc: "Your interview finished successfully.", color: "#22c55e", to: () => "/history" },
  oa_completed: { title: "OA Completed", desc: "Online Assessment round completed.", color: "#22c55e", to: () => "/history" },
  technical_completed: { title: "Technical Completed", desc: "Technical interview completed successfully.", color: "#22c55e", to: () => "/history" },
  hr_completed: { title: "HR Completed", desc: "HR round completed.", color: "#22c55e", to: () => "/history" },
  oa_started: { title: "OA Started", desc: "Online Assessment round started.", color: "#f59e0b", to: () => "/history" },
  technical_started: { title: "Technical Started", desc: "Technical interview started.", color: "#f59e0b", to: () => "/history" },
  hr_started: { title: "HR Started", desc: "HR round started.", color: "#f59e0b", to: () => "/history" },
  resume_uploaded: { title: "Resume Uploaded", desc: "Your resume was uploaded successfully.", color: "#f97316", to: () => "/history" },
  resume_analysis_completed: { title: "Resume Analysis Completed", desc: "Your resume analysis is ready.", color: "#eab308", to: () => "/history" },
  profile_built: { title: "Profile Built", desc: "Your candidate profile was built.", color: "#38bdf8", to: () => "/profile" },
  profile_updated: { title: "Profile Updated", desc: "Your profile changes were saved.", color: "#94a3b8", to: () => "/profile" },
};

const FALLBACK = { title: "Update", desc: "", color: "#94a3b8", to: () => "/activity" };

function notifKey(item) {
  return `${item.type}|${new Date(item.timestamp).toISOString()}`;
}

function readSet() {
  try {
    return new Set(JSON.parse(localStorage.getItem(READ_KEY) || "[]"));
  } catch {
    return new Set();
  }
}

function persistReadSet(set) {
  localStorage.setItem(READ_KEY, JSON.stringify([...set]));
}

/** Number of unread notifications among `items` (used for the bell badge). */
export function notifUnreadCount(items = []) {
  const read = readSet();
  return items.filter((it) => !read.has(notifKey(it))).length;
}

function cfgFor(type) {
  return TYPE_CONFIG[type] || FALLBACK;
}

export default function NotificationsMenu({ items = [], onClose, onReadChange }) {
  const navigate = useNavigate();
  const [read, setRead] = useState(() => readSet());

  const unreadCount = useMemo(
    () => items.filter((it) => !read.has(notifKey(it))).length,
    [items, read]
  );

  const markRead = useCallback(
    (keys) => {
      setRead((prev) => {
        const next = new Set(prev);
        keys.forEach((k) => next.add(k));
        persistReadSet(next);
        return next;
      });
      onReadChange?.();
    },
    [onReadChange]
  );

  const handleClickItem = useCallback(
    (item) => {
      const cfg = cfgFor(item.type);
      markRead([notifKey(item)]);
      onClose?.();
      navigate(cfg.to(item.meta));
    },
    [markRead, navigate, onClose]
  );

  const markAllRead = useCallback(() => {
    markRead(items.map(notifKey));
  }, [items, markRead]);

  return (
    <>
      {/* click-outside catcher */}
      <div className="fixed inset-0 z-[9998]" onClick={onClose} />

      <div className="notif-panel absolute right-0 mt-2 w-[calc(100vw-2rem)] max-w-sm sm:w-96 overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-white/5">
          <div className="flex items-center gap-2">
            <span className="text-base">🔔</span>
            <span className="text-sm font-semibold text-text-primary">Notifications</span>
            {unreadCount > 0 && (
              <span className="text-[11px] font-bold px-1.5 py-0.5 rounded-full bg-brand-500/20 text-brand-300">
                {unreadCount}
              </span>
            )}
          </div>
          <div className="flex items-center gap-3">
            {unreadCount > 0 && (
              <button onClick={markAllRead} className="text-xs text-text-secondary hover:text-text-primary transition-colors cursor-pointer">
                Mark all read
              </button>
            )}
            <button
              onClick={() => {
                onClose?.();
                navigate("/activity");
              }}
              className="text-xs text-brand-400 hover:text-brand-300 transition-colors cursor-pointer"
            >
              View all
            </button>
          </div>
        </div>

        {/* List */}
        {items.length ? (
          <div className="notif-scroll max-h-[22rem] overflow-y-auto p-2">
            {items.map((item, i) => {
              const cfg = cfgFor(item.type);
              const key = notifKey(item);
              const isUnread = !read.has(key);
              const description = item.type === "resume_uploaded" && item.label?.includes(":") ? item.label : cfg.desc;
              return (
                <button
                  key={key + i}
                  onClick={() => handleClickItem(item)}
                  style={{ animationDelay: `${Math.min(i, 8) * 30}ms` }}
                  className="notif-item group w-full text-left flex gap-3 p-3 rounded-2xl bg-white/[0.02] hover:bg-white/[0.06] border border-transparent hover:border-white/10 transition-transform duration-200 hover:scale-[1.02] cursor-pointer mb-1"
                >
                  {/* Color-coded icon */}
                  <span
                    className="mt-0.5 w-9 h-9 rounded-xl flex items-center justify-center shrink-0"
                    style={{ background: `${cfg.color}22`, border: `1px solid ${cfg.color}33` }}
                  >
                    <span className="w-2.5 h-2.5 rounded-full" style={{ background: cfg.color }} />
                  </span>

                  {/* Content */}
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-semibold text-text-primary truncate">{cfg.title}</p>
                      {isUnread && <span className="w-2 h-2 rounded-full bg-brand-500 shrink-0" />}
                    </div>
                    {description && <p className="text-xs text-text-secondary mt-0.5 leading-snug">{description}</p>}
                    <p className="text-[11px] text-text-muted mt-1 flex items-center gap-1">
                      <span>🕒</span>
                      {timeAgo(item.timestamp)}
                    </p>
                  </div>
                </button>
              );
            })}
          </div>
        ) : (
          /* Empty state */
          <div className="px-6 py-12 text-center">
            <div className="text-3xl mb-3">🔔</div>
            <p className="text-sm font-semibold text-text-primary">No Notifications Yet</p>
            <p className="text-xs text-text-muted mt-1">We'll notify you when something important happens.</p>
          </div>
        )}
      </div>
    </>
  );
}
