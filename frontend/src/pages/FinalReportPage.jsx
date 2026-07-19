import { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { getFinalReport, downloadReportPdf } from "../services/oaApi";

/**
 * FinalReportPage — consolidated candidate report across all three rounds
 * (OA + Technical + HR) combined with the résumé.
 *
 * Reached once all three rounds are complete. Fetches a detailed, Gemini-generated
 * report (strengths, weaknesses, areas to improve, overall score, per-round
 * performance, résumé alignment, and a final recommendation).
 */

const RATING_STYLES = {
  Excellent: "text-verified",
  Strong: "text-verified",
  Average: "text-unverified",
  "Needs Improvement": "text-unverified",
  Poor: "text-error",
};

function scoreColor(score) {
  if (score >= 75) return "#22c55e";
  if (score >= 50) return "#f59e0b";
  return "#ef4444";
}

export default function FinalReportPage() {
  const navigate = useNavigate();
  const [status, setStatus] = useState("loading"); // loading | error | ready
  const [errorMsg, setErrorMsg] = useState("");
  const [report, setReport] = useState(null);
  const [completedRounds, setCompletedRounds] = useState([]);
  const [pdfAvailable, setPdfAvailable] = useState(false);
  const [emailSent, setEmailSent] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [downloadErr, setDownloadErr] = useState("");

  const load = useCallback(async () => {
    setStatus("loading");
    setErrorMsg("");
    try {
      const data = await getFinalReport();
      setReport(data.report);
      setCompletedRounds(data.completed_rounds || []);
      setPdfAvailable(data.pdf_available !== false);
      setEmailSent(Boolean(data.email_sent));
      setStatus("ready");
    } catch (err) {
      setErrorMsg(
        err.response?.data?.message || err.message || "Unable to generate final report."
      );
      setStatus("error");
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const handleDownload = useCallback(async () => {
    setDownloading(true);
    setDownloadErr("");
    try {
      await downloadReportPdf();
    } catch (err) {
      setDownloadErr(
        err.response?.data?.message || err.message || "Unable to download the report PDF."
      );
    } finally {
      setDownloading(false);
    }
  }, []);

  // ── Loading ────────────────────────────────────────────────────────────────
  if (status === "loading") {
    return (
      <div className="min-h-screen flex items-center justify-center px-4">
        <div className="text-center animate-fade-in-up">
          <div className="relative w-20 h-20 mx-auto mb-6">
            <div className="absolute inset-0 rounded-full border-2 border-brand-500/20" />
            <div className="absolute inset-0 rounded-full border-2 border-transparent border-t-brand-500 animate-spin-slow" />
          </div>
          <h2 className="text-xl font-bold text-text-primary mb-2">
            Compiling Final Candidate Report…
          </h2>
          <p className="text-text-secondary text-sm max-w-sm mx-auto">
            Analyzing your OA, Technical and HR performance against your résumé.
          </p>
        </div>
      </div>
    );
  }

  // ── Error ──────────────────────────────────────────────────────────────────
  if (status === "error") {
    return (
      <div className="min-h-screen flex items-center justify-center px-4">
        <div className="text-center max-w-sm animate-fade-in-up">
          <div className="w-14 h-14 rounded-2xl bg-error/10 text-error flex items-center justify-center mx-auto mb-5">
            <svg className="w-7 h-7" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="12" cy="12" r="10" />
              <line x1="15" y1="9" x2="9" y2="15" />
              <line x1="9" y1="9" x2="15" y2="15" />
            </svg>
          </div>
          <h2 className="text-xl font-bold text-text-primary mb-2">Unable to generate report.</h2>
          <p className="text-text-secondary text-sm mb-6">{errorMsg}</p>
          <div className="flex gap-3 justify-center">
            <button
              type="button"
              onClick={() => navigate("/home")}
              className="py-2.5 px-5 rounded-xl font-semibold text-sm text-text-secondary
                         bg-surface-200 hover:bg-surface-300 border border-white/[0.06]
                         transition-all duration-200 cursor-pointer"
            >
              Back
            </button>
            <button
              type="button"
              onClick={load}
              className="py-2.5 px-5 rounded-xl font-semibold text-sm text-white
                         bg-gradient-to-r from-brand-500 to-brand-600 hover:from-brand-400 hover:to-brand-500
                         shadow-[0_0_20px_rgba(99,102,241,0.2)] transition-all duration-300 cursor-pointer"
            >
              Retry
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ── Ready ──────────────────────────────────────────────────────────────────
  const overall = Math.round(report.overall_score ?? 0);
  const ratingClass = RATING_STYLES[report.performance_rating] || "text-brand-400";
  const ring = 2 * Math.PI * 52;

  return (
    <div className="min-h-screen px-4 pt-10 pb-16">
      {/* Ambient background glow */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden -z-10">
        <div className="absolute top-[-20%] left-[-10%] w-[600px] h-[600px] rounded-full bg-brand-700/[0.07] blur-[120px]" />
        <div className="absolute bottom-[-20%] right-[-10%] w-[500px] h-[500px] rounded-full bg-brand-500/[0.05] blur-[100px]" />
      </div>

      <div className="max-w-4xl mx-auto animate-fade-in-up">
        {/* Header */}
        <div className="text-center mb-8">
          <h1 className="text-3xl font-extrabold text-text-primary mb-2 tracking-tight">
            Final Candidate Report
          </h1>
          <p className="text-text-secondary text-sm">
            Consolidated assessment across OA, Technical and HR rounds, calibrated against your résumé.
          </p>
          {completedRounds.length < 3 && (
            <p className="text-xs text-unverified mt-2">
              Note: only {completedRounds.join(", ") || "no rounds"} recorded this session — scores for
              missing rounds are estimated conservatively.
            </p>
          )}
        </div>

        {/* Overall score + rating */}
        <div className="glass-strong rounded-2xl p-8 mb-6 relative overflow-hidden">
          <div className="absolute top-0 inset-x-0 h-px bg-gradient-to-r from-transparent via-brand-400/30 to-transparent" />
          <div className="flex flex-col sm:flex-row items-center gap-8">
            <div className="relative w-32 h-32 shrink-0">
              <svg className="w-full h-full -rotate-90" viewBox="0 0 120 120">
                <circle cx="60" cy="60" r="52" fill="none" stroke="rgba(255,255,255,0.05)" strokeWidth="8" />
                <circle
                  cx="60" cy="60" r="52" fill="none"
                  stroke={scoreColor(overall)}
                  strokeWidth="8"
                  strokeLinecap="round"
                  strokeDasharray={`${ring}`}
                  strokeDashoffset={`${ring * (1 - overall / 100)}`}
                  style={{ transition: "stroke-dashoffset 1.5s ease-out" }}
                />
              </svg>
              <div className="absolute inset-0 flex flex-col items-center justify-center">
                <span className="text-3xl font-extrabold text-text-primary">{overall}</span>
                <span className="text-xs text-text-muted">/ 100</span>
              </div>
            </div>

            <div className="flex-1 text-center sm:text-left">
              <div className="flex items-center gap-2 justify-center sm:justify-start mb-2">
                <span className="text-xs uppercase tracking-wider text-text-muted">Performance</span>
                <span className={`text-sm font-bold ${ratingClass}`}>{report.performance_rating}</span>
              </div>
              <p className="text-text-secondary text-sm leading-relaxed">{report.overall_summary}</p>
            </div>
          </div>
        </div>

        {/* Per-round breakdown */}
        {report.round_breakdown?.length > 0 && (
          <div className="grid sm:grid-cols-3 gap-4 mb-6">
            {report.round_breakdown.map((r) => (
              <div key={r.round} className="glass-strong rounded-2xl p-5">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-bold text-text-primary">{r.round}</span>
                  <span
                    className="text-xs px-2 py-0.5 rounded-md font-semibold border"
                    style={{
                      color: scoreColor(r.score),
                      borderColor: `${scoreColor(r.score)}55`,
                      background: `${scoreColor(r.score)}1a`,
                    }}
                  >
                    {Math.round(r.score)}/100
                  </span>
                </div>
                <p className="text-xs text-text-secondary leading-relaxed">{r.summary}</p>
              </div>
            ))}
          </div>
        )}

        {/* Strengths & Weaknesses */}
        <div className="grid sm:grid-cols-2 gap-6 mb-6">
          <div className="glass-strong rounded-2xl p-6">
            <div className="flex items-center gap-2 mb-4 text-verified">
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <h3 className="text-sm font-semibold text-text-primary">Strengths</h3>
            </div>
            <ul className="space-y-3">
              {report.strengths?.map((s, i) => (
                <li key={i} className="flex gap-2.5 items-start text-sm text-text-secondary leading-relaxed">
                  <span className="text-verified mt-1 shrink-0">•</span>
                  <span>{s}</span>
                </li>
              ))}
              {(!report.strengths || report.strengths.length === 0) && (
                <p className="text-xs text-text-muted italic">None recorded.</p>
              )}
            </ul>
          </div>

          <div className="glass-strong rounded-2xl p-6">
            <div className="flex items-center gap-2 mb-4 text-error">
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
              <h3 className="text-sm font-semibold text-text-primary">Weaknesses</h3>
            </div>
            <ul className="space-y-3">
              {report.weaknesses?.map((w, i) => (
                <li key={i} className="flex gap-2.5 items-start text-sm text-text-secondary leading-relaxed">
                  <span className="text-error mt-1 shrink-0">•</span>
                  <span>{w}</span>
                </li>
              ))}
              {(!report.weaknesses || report.weaknesses.length === 0) && (
                <p className="text-xs text-text-muted italic">None recorded.</p>
              )}
            </ul>
          </div>
        </div>

        {/* Areas to improve */}
        <div className="glass-strong rounded-2xl p-6 mb-6">
          <div className="flex items-center gap-2 mb-4 text-brand-400">
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
              <path strokeLinecap="round" strokeLinejoin="round" d="M13 10V3L4 14h7v7l9-11h-7z" />
            </svg>
            <h3 className="text-sm font-semibold text-text-primary">Where You Should Improve</h3>
          </div>
          <ul className="space-y-3">
            {report.areas_to_improve?.map((a, i) => (
              <li key={i} className="flex gap-2.5 items-start text-sm text-text-secondary leading-relaxed">
                <span className="text-brand-400 mt-1 shrink-0">•</span>
                <span>{a}</span>
              </li>
            ))}
          </ul>
        </div>

        {/* Résumé alignment + recommendation */}
        <div className="grid sm:grid-cols-2 gap-6 mb-8">
          <div className="glass-strong rounded-2xl p-6">
            <h3 className="text-sm font-semibold text-text-primary mb-3">Résumé Alignment</h3>
            <p className="text-sm text-text-secondary leading-relaxed">{report.resume_alignment}</p>
          </div>
          <div className="glass-strong rounded-2xl p-6">
            <h3 className="text-sm font-semibold text-text-primary mb-3">Final Recommendation</h3>
            <p className="text-sm text-text-secondary leading-relaxed">{report.final_recommendation}</p>
          </div>
        </div>

        {/* Actions */}
        <div className="text-center">
          <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
            <button
              type="button"
              onClick={handleDownload}
              disabled={downloading || !pdfAvailable}
              className="py-3 px-8 rounded-xl font-semibold text-sm text-white bg-gradient-to-r from-brand-500 to-brand-600
                         hover:from-brand-400 hover:to-brand-500 shadow-[0_0_20px_rgba(99,102,241,0.2)]
                         hover:shadow-[0_0_30px_rgba(99,102,241,0.35)] transition-all duration-300 cursor-pointer
                         disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {downloading ? "Preparing PDF…" : "Download PDF"}
            </button>
            <button
              type="button"
              onClick={() => navigate("/home")}
              className="py-3 px-8 rounded-xl font-semibold text-sm text-text-primary border border-white/10
                         hover:bg-white/5 transition-all duration-300 cursor-pointer"
            >
              Back to Dashboard
            </button>
          </div>
          {downloadErr && <p className="text-xs text-error mt-3">{downloadErr}</p>}
          {emailSent && (
            <p className="text-xs text-text-muted mt-3">
              A copy of this report has been emailed to you.
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
