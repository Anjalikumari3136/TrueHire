import { useEffect, useRef, useState } from "react";

/**
 * Timer — 90 minute countdown for the OA round (STEP 7).
 *
 * Remaining time is derived from the server `startedAt` timestamp, so the
 * countdown stays correct even after an accidental page reload. Calls
 * `onExpire` exactly once when it hits 00:00 (auto-end the interview).
 */
export default function Timer({ startedAt, durationMinutes = 90, onExpire }) {
  const expiredRef = useRef(false);

  const computeRemaining = () => {
    const start = new Date(startedAt).getTime();
    const end = start + durationMinutes * 60 * 1000;
    return Math.max(0, Math.floor((end - Date.now()) / 1000));
  };

  const [remaining, setRemaining] = useState(computeRemaining);

  useEffect(() => {
    const tick = () => {
      const r = computeRemaining();
      setRemaining(r);
      if (r <= 0 && !expiredRef.current) {
        expiredRef.current = true;
        onExpire?.();
      }
    };
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [startedAt, durationMinutes]);

  const mm = String(Math.floor(remaining / 60)).padStart(2, "0");
  const ss = String(remaining % 60).padStart(2, "0");
  const isDanger = remaining <= 300; // last 5 minutes

  return (
    <div
      className={`flex items-center gap-2 px-3.5 py-2 rounded-xl border font-mono text-sm font-semibold tabular-nums
        ${isDanger
          ? "bg-error/10 border-error/30 text-error animate-pulse"
          : "bg-surface-100 border-white/[0.08] text-text-primary"
        }`}
      title="Time remaining"
    >
      <svg className="w-4 h-4 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <circle cx="12" cy="12" r="9" />
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 7v5l3 2" />
      </svg>
      {mm}:{ss}
    </div>
  );
}
