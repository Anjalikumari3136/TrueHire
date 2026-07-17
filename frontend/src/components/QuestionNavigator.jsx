/**
 * QuestionNavigator — Previous / Next controls plus per-question pills (STEP 6).
 *
 * `answeredFlags` is a boolean array (one per question) used to visually mark
 * which questions have been attempted. Selecting a pill never erases code —
 * the parent keeps a separate editor buffer for every question.
 */
export default function QuestionNavigator({
  total,
  currentIndex,
  answeredFlags = [],
  onSelect,
  onPrev,
  onNext,
}) {
  const isFirst = currentIndex === 0;
  const isLast = currentIndex === total - 1;

  return (
    <div className="flex items-center justify-between gap-4 flex-wrap">
      <button
        type="button"
        onClick={onPrev}
        disabled={isFirst}
        className="py-2.5 px-4 rounded-xl font-semibold text-sm text-text-secondary
                   bg-surface-200 hover:bg-surface-300 border border-white/[0.06]
                   disabled:opacity-40 disabled:cursor-not-allowed
                   transition-all duration-200 cursor-pointer flex items-center gap-2"
      >
        <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
        </svg>
        Previous
      </button>

      {/* Question pills */}
      <div className="flex items-center gap-2">
        {Array.from({ length: total }).map((_, i) => {
          const isActive = i === currentIndex;
          const isAnswered = answeredFlags[i];
          return (
            <button
              key={i}
              type="button"
              onClick={() => onSelect(i)}
              title={`Question ${i + 1}${isAnswered ? " (attempted)" : ""}`}
              className={`w-9 h-9 rounded-lg text-sm font-bold border transition-all duration-200 cursor-pointer
                ${isActive
                  ? "bg-gradient-to-r from-brand-500 to-brand-600 text-white border-brand-500 shadow-[0_0_16px_rgba(99,102,241,0.35)]"
                  : isAnswered
                    ? "bg-verified/10 text-verified border-verified/30 hover:border-verified/50"
                    : "bg-surface-100 text-text-secondary border-white/[0.08] hover:border-brand-500/40"
                }`}
            >
              {i + 1}
            </button>
          );
        })}
      </div>

      <button
        type="button"
        onClick={onNext}
        disabled={isLast}
        className="py-2.5 px-4 rounded-xl font-semibold text-sm text-text-secondary
                   bg-surface-200 hover:bg-surface-300 border border-white/[0.06]
                   disabled:opacity-40 disabled:cursor-not-allowed
                   transition-all duration-200 cursor-pointer flex items-center gap-2"
      >
        Next
        <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
        </svg>
      </button>
    </div>
  );
}
