import { useCallback, useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { getReportById } from "../services/dashboardApi";
import { downloadReportPdf } from "../services/oaApi";

/**
 * Report view (/dashboard/report/:interviewId).
 *
 * Opens a specific stored report by interviewId (ownership enforced server-side).
 * This is a NEW, additive page for the dashboard deep-link — it does not touch
 * the existing FinalReportPage (/interview/final-report), which keeps working.
 */

function scoreColor(score) {
  const n = Number(score) || 0;
  if (n >= 75) return "#22c55e";
  if (n >= 50) return "#f59e0b";
  return "#ef4444";
}

function List({ items, empty = "None recorded.", dot = "text-brand-400" }) {
  if (!items || !items.length) return <p className="text-xs text-text-muted italic">{empty}</p>;
  return (
    <ul className="space-y-2">
      {items.map((it, i) => (
        <li key={i} className="flex gap-2.5 items-start text-sm text-text-secondary leading-relaxed">
          <span className={`${dot} mt-1 shrink-0`}>•</span>
          <span>{typeof it === "string" ? it : JSON.stringify(it)}</span>
        </li>
      ))}
    </ul>
  );
}

function Card({ title, children }) {
  return (
    <div className="glass-strong rounded-2xl p-6">
      <h3 className="text-sm font-semibold text-text-primary mb-3">{title}</h3>
      {children}
    </div>
  );
}

export default function ReportViewPage() {
  const { interviewId } = useParams();
  const navigate = useNavigate();
  const [status, setStatus] = useState("loading");
  const [report, setReport] = useState(null);
  const [errorMsg, setErrorMsg] = useState("");
  const [downloading, setDownloading] = useState(false);

  const load = useCallback(async () => {
    setStatus("loading");
    try {
      const data = await getReportById(interviewId);
      setReport(data.report || {});
      setStatus("ready");
    } catch (err) {
      setErrorMsg(err.response?.data?.message || err.message || "Unable to load report.");
      setStatus("error");
    }
  }, [interviewId]);

  useEffect(() => {
    load();
  }, [load]);

  const handleDownload = useCallback(async () => {
    setDownloading(true);
    try {
      await downloadReportPdf(interviewId);
    } catch {
      /* keep resilient */
    } finally {
      setDownloading(false);
    }
  }, [interviewId]);

  if (status === "loading") {
    return <div className="min-h-screen flex items-center justify-center"><p className="text-text-secondary text-sm">Loading report…</p></div>;
  }
  if (status === "error") {
    return (
      <div className="min-h-screen flex items-center justify-center px-4">
        <div className="text-center max-w-sm">
          <p className="text-error text-sm mb-5">{errorMsg}</p>
          <button onClick={() => navigate("/home")} className="py-2.5 px-6 rounded-xl font-semibold text-sm text-white bg-gradient-to-r from-brand-500 to-brand-600 cursor-pointer">Back to Dashboard</button>
        </div>
      </div>
    );
  }

  const tr = report.technical_round || {};
  const hr = report.hr_round || {};
  const oa = report.oa_round || {};
  const overall = Math.round(report.overall_score ?? 0);

  return (
    <div className="min-h-screen px-4 sm:px-6 pt-6 pb-16">
      <div className="fixed inset-0 pointer-events-none overflow-hidden -z-10">
        <div className="absolute top-[-20%] left-[-10%] w-[600px] h-[600px] rounded-full bg-brand-700/[0.07] blur-[120px]" />
      </div>

      <div className="max-w-4xl mx-auto animate-fade-in-up space-y-6">
        {/* Header actions */}
        <div className="flex items-center justify-between">
          <button onClick={() => navigate("/home")} className="text-xs px-3 py-2 rounded-xl text-text-secondary border border-white/10 hover:bg-white/5 cursor-pointer">← Dashboard</button>
          <button onClick={handleDownload} disabled={downloading} className="text-xs px-4 py-2 rounded-xl font-semibold text-white bg-gradient-to-r from-brand-500 to-brand-600 cursor-pointer disabled:opacity-50">
            {downloading ? "Preparing PDF…" : "Download PDF"}
          </button>
        </div>

        {/* Overall */}
        <div className="glass-strong rounded-2xl p-8 flex flex-col sm:flex-row items-center gap-8">
          <div className="relative w-28 h-28 shrink-0">
            <svg className="w-full h-full -rotate-90" viewBox="0 0 120 120">
              <circle cx="60" cy="60" r="52" fill="none" stroke="rgba(255,255,255,0.05)" strokeWidth="8" />
              <circle cx="60" cy="60" r="52" fill="none" stroke={scoreColor(overall)} strokeWidth="8" strokeLinecap="round" strokeDasharray={2 * Math.PI * 52} strokeDashoffset={2 * Math.PI * 52 * (1 - overall / 100)} />
            </svg>
            <div className="absolute inset-0 flex flex-col items-center justify-center">
              <span className="text-2xl font-extrabold text-text-primary">{overall}</span>
              <span className="text-xs text-text-muted">/ 100</span>
            </div>
          </div>
          <div className="flex-1 text-center sm:text-left">
            <p className="text-xs uppercase tracking-wider text-text-muted">Performance · {report.performance_rating || "—"}</p>
            <p className="text-sm text-brand-300 font-semibold mt-1">{report.hiring_recommendation || report.final_recommendation || "—"}</p>
            <p className="text-text-secondary text-sm leading-relaxed mt-2">{report.overall_summary}</p>
          </div>
        </div>

        {/* Strengths / Weaknesses */}
        <div className="grid sm:grid-cols-2 gap-6">
          <Card title="Strengths"><List items={report.strengths} dot="text-verified" /></Card>
          <Card title="Weaknesses"><List items={report.weaknesses} dot="text-error" /></Card>
        </div>

        {/* Round details */}
        <div className="grid sm:grid-cols-3 gap-6">
          <Card title="OA Round">
            <div className="space-y-1.5 text-sm text-text-secondary">
              <p>Score: <span className="text-text-primary">{Math.round(oa.score ?? 0)}/100</span></p>
              <p>Attempted: <span className="text-text-primary">{oa.questions_attempted ?? 0}</span></p>
              <p>Correct: <span className="text-text-primary">{oa.correct_answers ?? 0}</span></p>
              {oa.ai_feedback && <p className="text-xs text-text-muted pt-1">{oa.ai_feedback}</p>}
            </div>
          </Card>
          <Card title="Technical Round">
            <div className="space-y-1 text-xs text-text-secondary">
              {["coding_skills", "dsa", "frontend", "backend", "database", "api_design", "debugging"].map((k) =>
                tr[k] ? <p key={k}><span className="text-text-muted capitalize">{k.replace(/_/g, " ")}:</span> {tr[k]}</p> : null
              )}
            </div>
          </Card>
          <Card title="HR Round">
            <div className="space-y-1 text-xs text-text-secondary">
              {["communication", "confidence", "leadership", "teamwork", "behaviour"].map((k) =>
                hr[k] ? <p key={k}><span className="text-text-muted capitalize">{k}:</span> {hr[k]}</p> : null
              )}
            </div>
          </Card>
        </div>

        {/* Recommendations */}
        <div className="grid sm:grid-cols-2 gap-6">
          <Card title="Areas to Improve"><List items={report.areas_to_improve} /></Card>
          <Card title="Learning Recommendations"><List items={report.learning_recommendations} /></Card>
        </div>

        {(report.career_suggestions?.length > 0 || report.final_summary) && (
          <div className="grid sm:grid-cols-2 gap-6">
            {report.career_suggestions?.length > 0 && <Card title="AI Career Suggestions"><List items={report.career_suggestions} /></Card>}
            {report.final_summary && <Card title="Final Summary"><p className="text-sm text-text-secondary leading-relaxed">{report.final_summary}</p></Card>}
          </div>
        )}
      </div>
    </div>
  );
}
