/**
 * QuestionPanel
 * Renders a single OA coding question (STEP 5): title, difficulty badge,
 * problem statement, worked examples, and constraints.
 *
 * Question shape (from FastAPI/Gemini):
 *   { id, difficulty, title, problem, constraints, examples: [{input, output, explanation}] }
 */

const DIFFICULTY_STYLES = {
  Easy: "bg-verified/15 text-verified border-verified/25",
  Medium: "bg-unverified/15 text-unverified border-unverified/25",
  Hard: "bg-error/15 text-error border-error/25",
};

export default function QuestionPanel({ question, index, total }) {
  if (!question) return null;

  const {
    title,
    difficulty,
    problem,
    constraints,
    examples = [],
  } = question;

  const badgeClass =
    DIFFICULTY_STYLES[difficulty] || "bg-brand-500/15 text-brand-300 border-brand-500/20";

  // constraints may arrive as a single string (possibly newline-separated) or an array.
  const constraintList = Array.isArray(constraints)
    ? constraints
    : String(constraints || "")
        .split("\n")
        .map((c) => c.trim())
        .filter(Boolean);

  return (
    <div className="glass-strong rounded-2xl p-6 relative overflow-hidden h-full overflow-y-auto">
      <div className="absolute top-0 inset-x-0 h-px bg-gradient-to-r from-transparent via-brand-400/30 to-transparent" />

      {/* Question counter + difficulty */}
      <div className="flex items-center justify-between gap-3 mb-3">
        <span className="text-xs font-semibold uppercase tracking-wider text-text-muted">
          Question {index + 1} of {total}
        </span>
        {difficulty && (
          <span className={`text-xs px-2.5 py-0.5 rounded-md font-semibold border ${badgeClass}`}>
            {difficulty}
          </span>
        )}
      </div>

      {/* Title */}
      <h2 className="text-lg font-bold text-text-primary tracking-tight mb-4">{title}</h2>

      {/* Problem statement */}
      <section className="mb-5">
        <h3 className="text-xs font-semibold uppercase tracking-wider text-text-muted mb-2">
          Problem Statement
        </h3>
        <p className="text-sm text-text-secondary leading-relaxed whitespace-pre-line">
          {problem}
        </p>
      </section>

      {/* Examples */}
      {examples.length > 0 && (
        <section className="mb-5">
          <h3 className="text-xs font-semibold uppercase tracking-wider text-text-muted mb-2">
            Examples
          </h3>
          <div className="space-y-3">
            {examples.map((ex, i) => (
              <div
                key={i}
                className="rounded-xl bg-surface-100 border border-white/[0.06] p-3 space-y-2"
              >
                <div>
                  <span className="text-xs font-semibold text-text-muted">Input: </span>
                  <code className="text-sm text-text-primary font-mono break-words">{ex.input}</code>
                </div>
                <div>
                  <span className="text-xs font-semibold text-text-muted">Output: </span>
                  <code className="text-sm text-text-primary font-mono break-words">{ex.output}</code>
                </div>
                {ex.explanation && (
                  <div>
                    <span className="text-xs font-semibold text-text-muted">Explanation: </span>
                    <span className="text-sm text-text-secondary">{ex.explanation}</span>
                  </div>
                )}
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Constraints */}
      {constraintList.length > 0 && (
        <section>
          <h3 className="text-xs font-semibold uppercase tracking-wider text-text-muted mb-2">
            Constraints
          </h3>
          <ul className="space-y-1.5">
            {constraintList.map((c, i) => (
              <li key={i} className="flex items-start gap-2 text-sm text-text-secondary">
                <span className="text-brand-400 mt-1 shrink-0">•</span>
                <span className="font-mono break-words">{c}</span>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
