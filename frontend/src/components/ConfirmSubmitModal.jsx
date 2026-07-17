/**
 * ConfirmSubmitModal — end-of-test confirmation (STEP 8) with an unanswered
 * questions warning (STEP 9).
 *
 * - No unanswered questions → "Are you sure?" with Cancel / End Test.
 * - Some unanswered           → lists them, offers Continue Editing / End Anyway.
 */
export default function ConfirmSubmitModal({
  open,
  unanswered = [],
  submitting = false,
  onCancel,
  onConfirm,
  title = "End Test?",
  message = "Are you sure you want to end the test? Once submitted you cannot return to edit your answers.",
  confirmLabel = "End Test",
  cancelLabel = "Cancel",
}) {
  if (!open) return null;

  const hasUnanswered = unanswered.length > 0;

  return (
    <div className="fixed inset-0 z-[1000] flex items-center justify-center px-4 bg-black/60 backdrop-blur-sm animate-fade-in">
      <div className="w-full max-w-md glass-strong rounded-2xl p-7 relative overflow-hidden animate-fade-in-up">
        <div className="absolute top-0 inset-x-0 h-px bg-gradient-to-r from-transparent via-brand-400/30 to-transparent" />

        {/* Icon */}
        <div
          className={`w-12 h-12 rounded-xl flex items-center justify-center mb-4
            ${hasUnanswered ? "bg-unverified/10 text-unverified" : "bg-error/10 text-error"}`}
        >
          <svg className="w-6 h-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v4m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
          </svg>
        </div>

        <h2 className="text-lg font-bold text-text-primary mb-2">
          {hasUnanswered ? "Some questions are unanswered" : title}
        </h2>

        {hasUnanswered ? (
          <p className="text-sm text-text-secondary leading-relaxed mb-5">
            You have not attempted {unanswered.join(" and ")}. Ending now will submit
            your assessment as-is. Are you sure you want to continue?
          </p>
        ) : (
          <p className="text-sm text-text-secondary leading-relaxed mb-5">{message}</p>
        )}

        <div className="flex gap-3">
          <button
            type="button"
            onClick={onCancel}
            disabled={submitting}
            className="w-1/2 py-3 px-4 rounded-xl font-semibold text-sm text-text-secondary
                       bg-surface-200 hover:bg-surface-300 border border-white/[0.06]
                       disabled:opacity-50 transition-all duration-200 cursor-pointer"
          >
            {hasUnanswered ? "Continue Editing" : cancelLabel}
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={submitting}
            className="w-1/2 py-3 px-4 rounded-xl font-semibold text-sm text-white
                       bg-gradient-to-r from-error to-error/80 hover:opacity-90
                       disabled:opacity-50 disabled:cursor-not-allowed
                       transition-all duration-200 cursor-pointer flex items-center justify-center gap-2"
          >
            {submitting ? (
              <>
                <span className="w-4 h-4 rounded-full border-2 border-white/40 border-t-white animate-spin-slow" />
                Submitting…
              </>
            ) : hasUnanswered ? (
              "End Anyway"
            ) : (
              confirmLabel
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
