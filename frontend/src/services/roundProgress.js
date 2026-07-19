/**
 * Round progression tracking.
 *
 * The interview must be taken in order: OA → Technical → HR. A round stays
 * locked until every round before it has been completed. Progress is stored
 * in localStorage (no DB yet) so it survives reloads and navigation.
 */

const KEY = "truehire_round_progress";

// The required order of rounds.
export const ROUND_ORDER = ["OA", "Technical", "HR"];

export function getProgress() {
  try {
    return JSON.parse(localStorage.getItem(KEY)) || {};
  } catch {
    return {};
  }
}

export function markRoundComplete(round) {
  if (!round) return;
  const progress = getProgress();
  progress[round] = true;
  localStorage.setItem(KEY, JSON.stringify(progress));
}

/**
 * Reset ALL interview-scoped client state so a brand-new interview starts fresh
 * across every round (OA → Technical → HR). Called right after Build Profile
 * completes, since each résumé upload begins a completely new interview session.
 * Clears the round-progress gate and any cached OA/flow state, so OA re-runs
 * from scratch and Technical/HR are locked again until their prerequisites pass.
 */
export function resetInterviewProgress() {
  try {
    localStorage.removeItem(KEY); // round-progress gate (OA/Technical/HR)
    sessionStorage.removeItem("truehire_oa_state"); // cached OA questions/answers
    sessionStorage.removeItem("truehire_flow_ctx"); // onboarding flow context
    sessionStorage.removeItem("truehire_return_round_select");
  } catch {
    /* storage unavailable — nothing to reset */
  }
}

/**
 * A round is unlocked only when all rounds before it in ROUND_ORDER are done.
 * OA (the first round) is always unlocked.
 */
export function isRoundUnlocked(round, progress = getProgress()) {
  const idx = ROUND_ORDER.indexOf(round);
  if (idx <= 0) return true;
  return ROUND_ORDER.slice(0, idx).every((r) => progress[r]);
}

/** The round that must be completed to unlock `round` (null for the first). */
export function prerequisiteOf(round) {
  const idx = ROUND_ORDER.indexOf(round);
  return idx > 0 ? ROUND_ORDER[idx - 1] : null;
}
