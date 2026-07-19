/**
 * Shared round-evaluation report UI.
 *
 * Extracted from InterviewChat so the OA report and the Technical/HR report
 * render with the IDENTICAL layout, styling and UX. Both rounds produce the
 * same report shape (overall_score, strengths, gaps, recommended_focus_areas,
 * summary), so this component renders either one.
 *
 * `actions` lets each caller supply its own buttons below the report.
 */

export function RoundReportLoading({
  title = "Compiling Readiness Report...",
  subtitle = "Please wait while Gemini evaluates your submission and grades your profile.",
}) {
  return (
    <div className="min-h-screen flex items-center justify-center px-4 pt-16">
      <div className="text-center animate-fade-in-up">
        <div className="relative w-24 h-24 mx-auto mb-8">
          <div className="absolute inset-0 rounded-full border-2 border-brand-500/20" />
          <div className="absolute inset-0 rounded-full border-2 border-transparent border-t-brand-500 animate-spin-slow" />
          <div className="absolute inset-3 rounded-full bg-brand-500/10 animate-pulse-glow flex items-center justify-center">
            <svg className="w-8 h-8 text-brand-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.5">
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
          </div>
        </div>
        <h2 className="text-xl font-bold text-text-primary mb-2">{title}</h2>
        <p className="text-text-secondary text-sm max-w-sm mx-auto">{subtitle}</p>
      </div>
    </div>
  );
}

export function RoundReportError({ message, onRetry, retryLabel = "Retry Compilation" }) {
  return (
    <div className="min-h-screen flex items-center justify-center px-4 pt-16">
      <div className="text-center max-w-sm">
        <svg className="w-12 h-12 text-error mx-auto mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.5">
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
        </svg>
        <h2 className="text-lg font-bold text-text-primary mb-2">Readiness Compilation Failed</h2>
        <p className="text-text-secondary text-sm mb-6">{message || "An unexpected server error occurred."}</p>
        {onRetry && (
          <button
            onClick={onRetry}
            className="py-2.5 px-6 rounded-xl font-semibold text-sm text-white bg-brand-500 hover:bg-brand-400 transition-all cursor-pointer"
          >
            {retryLabel}
          </button>
        )}
      </div>
    </div>
  );
}

export default function RoundReportView({
  report,
  title = "Interview Evaluation Report",
  subtitle = "Consolidated readiness insights for your targeted practice session.",
  /** Scores arrive 0-10 (interview agent) or 0-100 (OA). */
  scoreScale = 10,
  actions = null,
}) {
  if (!report) return null;

  const pct = Math.max(
    0,
    Math.min(100, Math.round((Number(report.overall_score) || 0) * (100 / scoreScale)))
  );
  const summaryText = report.summary || report.readiness_summary || "";

  return (
    <div className="min-h-screen pt-24 pb-16 px-4 bg-surface-0">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="text-center mb-10 animate-fade-in-up">
          <h1 className="text-3xl font-extrabold text-text-primary mb-2 tracking-tight">{title}</h1>
          <p className="text-text-secondary text-sm">{subtitle}</p>
        </div>

        {/* Overall score card */}
        <div className="glass-strong rounded-2xl p-8 mb-8 animate-fade-in-up" style={{ animationDelay: '0.1s' }}>
          <div className="flex flex-col sm:flex-row items-center gap-8">
            <div className="relative w-32 h-32 shrink-0">
              <svg className="w-full h-full -rotate-90" viewBox="0 0 120 120">
                <circle cx="60" cy="60" r="52" fill="none" stroke="rgba(255,255,255,0.05)" strokeWidth="8" />
                <circle
                  cx="60" cy="60" r="52" fill="none"
                  stroke="url(#report-rate-gradient)"
                  strokeWidth="8"
                  strokeLinecap="round"
                  strokeDasharray={`${2 * Math.PI * 52}`}
                  strokeDashoffset={`${2 * Math.PI * 52 * (1 - pct / 100)}`}
                  style={{ transition: 'stroke-dashoffset 1.5s ease-out' }}
                />
                <defs>
                  <linearGradient id="report-rate-gradient" x1="0%" y1="0%" x2="100%" y2="0%">
                    <stop offset="0%" stopColor="#6366f1" />
                    <stop offset="100%" stopColor="#22c55e" />
                  </linearGradient>
                </defs>
              </svg>
              <div className="absolute inset-0 flex flex-col items-center justify-center">
                <span className="text-3xl font-extrabold text-text-primary">{pct}%</span>
                <span className="text-xs text-text-muted">Readiness</span>
              </div>
            </div>

            <div className="flex-1 text-center sm:text-left">
              <h2 className="text-xl font-bold text-text-primary mb-2">Session Readiness Summary</h2>
              <p className="text-text-secondary text-sm leading-relaxed">{summaryText}</p>
            </div>
          </div>
        </div>

        {/* Strengths & Gaps */}
        <div className="grid sm:grid-cols-2 gap-6 mb-8 animate-fade-in-up" style={{ animationDelay: '0.2s' }}>
          <div className="glass-strong rounded-2xl p-6">
            <div className="flex items-center gap-2 mb-4 text-verified">
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <h3 className="text-sm font-semibold text-text-primary">Key Strengths</h3>
            </div>
            <ul className="space-y-3">
              {report.strengths?.map((str, idx) => (
                <li key={idx} className="flex gap-2.5 items-start text-sm text-text-secondary leading-relaxed">
                  <span className="text-verified mt-1 shrink-0">•</span>
                  <span>{str}</span>
                </li>
              ))}
              {(!report.strengths || report.strengths.length === 0) && (
                <p className="text-xs text-text-muted italic">No specific strengths recorded.</p>
              )}
            </ul>
          </div>

          <div className="glass-strong rounded-2xl p-6">
            <div className="flex items-center gap-2 mb-4 text-unverified">
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
              <h3 className="text-sm font-semibold text-text-primary">Identified Gaps</h3>
            </div>
            <ul className="space-y-3">
              {report.gaps?.map((gap, idx) => (
                <li key={idx} className="flex gap-2.5 items-start text-sm text-text-secondary leading-relaxed">
                  <span className="text-unverified mt-1 shrink-0">•</span>
                  <span>{gap}</span>
                </li>
              ))}
              {(!report.gaps || report.gaps.length === 0) && (
                <p className="text-xs text-text-muted italic">No significant gaps identified.</p>
              )}
            </ul>
          </div>
        </div>

        {/* Recommended focus areas */}
        <div className="glass-strong rounded-2xl p-6 mb-8 animate-fade-in-up" style={{ animationDelay: '0.3s' }}>
          <div className="flex items-center gap-2 mb-4 text-brand-400">
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
              <path strokeLinecap="round" strokeLinejoin="round" d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
            </svg>
            <h3 className="text-sm font-semibold text-text-primary">Recommended Focus Areas</h3>
          </div>
          <ul className="space-y-3">
            {report.recommended_focus_areas?.map((item, idx) => (
              <li key={idx} className="flex gap-2.5 items-start text-sm text-text-secondary leading-relaxed">
                <span className="text-brand-400 mt-1 shrink-0">•</span>
                <span>{item}</span>
              </li>
            ))}
          </ul>
        </div>

        {actions}
      </div>
    </div>
  );
}
