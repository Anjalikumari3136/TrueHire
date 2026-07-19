import { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { getInterviewHistory } from "../services/dashboardApi";
import { downloadReportPdf } from "../services/oaApi";

/**
 * Reports page (/reports) — lists every generated report with View,
 * Download PDF, Interview Date, Overall Score and Status. Data comes from
 * GET /api/oa/reports, scoped to the authenticated user.
 */

function scoreColor(score) {
  const n = Number(score) || 0;
  if (n >= 75) return "#22c55e";
  if (n >= 50) return "#f59e0b";
  return "#ef4444";
}

function formatDate(value) {
  if (!value) return "—";
  try {
    return new Date(value).toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" });
  } catch {
    return "—";
  }
}

export default function ReportsPage() {
  const navigate = useNavigate();
  const [status, setStatus] = useState("loading");
  const [rows, setRows] = useState([]);
  const [errorMsg, setErrorMsg] = useState("");
  const [downloadingId, setDownloadingId] = useState(null);

  const load = useCallback(async () => {
    setStatus("loading");
    try {
      const all = await getInterviewHistory();
      // Reports = sessions that actually produced a PDF report.
      setRows(all.filter((r) => r.pdf_available || r.overall_score != null));
      setStatus("ready");
    } catch (err) {
      setErrorMsg(err.response?.data?.message || err.message || "Unable to load reports.");
      setStatus("error");
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const handleDownload = useCallback(async (interviewId) => {
    setDownloadingId(interviewId);
    try {
      await downloadReportPdf(interviewId);
    } catch {
      /* keep resilient */
    } finally {
      setDownloadingId(null);
    }
  }, []);

  return (
    <div className="min-h-screen px-4 sm:px-6 pt-6 pb-16">
      <div className="fixed inset-0 pointer-events-none overflow-hidden -z-10">
        <div className="absolute top-[-20%] left-[-10%] w-[600px] h-[600px] rounded-full bg-brand-700/[0.07] blur-[120px]" />
      </div>

      <div className="max-w-4xl mx-auto animate-fade-in-up">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-2xl font-extrabold text-text-primary tracking-tight">Reports</h1>
            <p className="text-text-secondary text-sm mt-1">All your generated interview reports.</p>
          </div>
          <button onClick={() => navigate("/home")} className="text-xs px-3 py-2 rounded-xl text-text-secondary border border-white/10 hover:bg-white/5 cursor-pointer">← Dashboard</button>
        </div>

        {status === "loading" && <p className="text-text-secondary text-sm text-center py-16">Loading…</p>}
        {status === "error" && <p className="text-error text-sm text-center py-16">{errorMsg}</p>}

        {status === "ready" &&
          (rows.length ? (
            <div className="space-y-3">
              {rows.map((r) => (
                <div key={r.interview_id} className="glass-strong rounded-2xl p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-text-primary truncate">{r.resume_name || "Interview Report"}</p>
                    <p className="text-xs text-text-muted mt-0.5">Interview Date: {formatDate(r.generated_at)}</p>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <span className="text-xs px-2.5 py-1 rounded-md font-semibold border" style={{ color: scoreColor(r.overall_score), borderColor: `${scoreColor(r.overall_score)}55`, background: `${scoreColor(r.overall_score)}1a` }}>
                      {Math.round(r.overall_score ?? 0)}/100
                    </span>
                    <span className="text-xs px-2 py-1 rounded-md text-verified border border-verified/30 bg-verified/10">Completed</span>
                    <button onClick={() => navigate(`/dashboard/report/${r.interview_id}`)} className="text-xs px-3 py-1.5 rounded-md text-text-secondary hover:text-text-primary border border-white/10 cursor-pointer">
                      View
                    </button>
                    {r.pdf_available && (
                      <button onClick={() => handleDownload(r.interview_id)} disabled={downloadingId === r.interview_id} className="text-xs px-3 py-1.5 rounded-md text-brand-300 hover:text-brand-200 border border-brand-500/30 cursor-pointer disabled:opacity-50">
                        {downloadingId === r.interview_id ? "…" : "Download PDF"}
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="glass-strong rounded-2xl p-10 text-center">
              <p className="text-text-secondary text-sm mb-5">No reports yet. Complete an interview to generate your first report.</p>
              <button onClick={() => navigate("/dashboard")} className="py-2.5 px-6 rounded-xl font-semibold text-sm text-white bg-gradient-to-r from-brand-500 to-brand-600 cursor-pointer">
                Start New Interview
              </button>
            </div>
          ))}
      </div>
    </div>
  );
}
