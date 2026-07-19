import { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { getActivity } from "../services/dashboardApi";
import { timeAgo } from "../utils/timeAgo";

/**
 * Activity page (/activity) — the full, dynamic, newest-first activity feed
 * for the authenticated user (GET /api/activity).
 */

// Icon accent per event family.
function dotColor(type = "") {
  if (type.startsWith("report")) return "#818cf8";
  if (type.endsWith("_completed") || type === "interview_completed") return "#22c55e";
  if (type.endsWith("_started")) return "#f59e0b";
  if (type === "resume_uploaded" || type === "profile_updated" || type === "profile_built") return "#38bdf8";
  return "#94a3b8";
}

export default function ActivityPage() {
  const navigate = useNavigate();
  const [status, setStatus] = useState("loading");
  const [items, setItems] = useState([]);
  const [errorMsg, setErrorMsg] = useState("");

  const load = useCallback(async () => {
    setStatus("loading");
    try {
      setItems(await getActivity());
      setStatus("ready");
    } catch (err) {
      setErrorMsg(err.response?.data?.message || err.message || "Unable to load activity.");
      setStatus("error");
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  return (
    <div className="min-h-screen px-4 sm:px-6 pt-6 pb-16">
      <div className="fixed inset-0 pointer-events-none overflow-hidden -z-10">
        <div className="absolute top-[-20%] left-[-10%] w-[600px] h-[600px] rounded-full bg-brand-700/[0.07] blur-[120px]" />
      </div>

      <div className="max-w-2xl mx-auto animate-fade-in-up">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-2xl font-extrabold text-text-primary tracking-tight">Recent Activity</h1>
            <p className="text-text-secondary text-sm mt-1">Everything that happened on your account.</p>
          </div>
          <button onClick={() => navigate("/home")} className="text-xs px-3 py-2 rounded-xl text-text-secondary border border-white/10 hover:bg-white/5 cursor-pointer">← Dashboard</button>
        </div>

        {status === "loading" && <p className="text-text-secondary text-sm text-center py-16">Loading…</p>}
        {status === "error" && <p className="text-error text-sm text-center py-16">{errorMsg}</p>}

        {status === "ready" &&
          (items.length ? (
            <div className="glass-strong rounded-2xl p-6">
              <ul className="space-y-5">
                {items.map((ev, i) => (
                  <li key={i} className="flex gap-3">
                    <div className="flex flex-col items-center">
                      <span className="w-2.5 h-2.5 rounded-full mt-1.5" style={{ background: dotColor(ev.type) }} />
                      {i < items.length - 1 && <span className="flex-1 w-px bg-white/10 my-1" />}
                    </div>
                    <div className="pb-1">
                      <p className="text-sm text-text-primary">{ev.label}</p>
                      <p className="text-xs text-text-muted">{timeAgo(ev.timestamp)}</p>
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          ) : (
            <div className="glass-strong rounded-2xl p-10 text-center">
              <p className="text-text-secondary text-sm">No activity yet.</p>
            </div>
          ))}
      </div>
    </div>
  );
}
