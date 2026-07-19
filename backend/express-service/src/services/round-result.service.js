import prisma from "../config/prisma.js";

/**
 * Round result persistence.
 *
 * Everything about an individual interview round used to live only in FastAPI's
 * process memory (the generated OA questions, the submitted code, the
 * Technical/HR transcript, the per-round report) and was lost on every restart.
 * These helpers write that data into RoundResult, keyed by the candidate's
 * CURRENT interview session + round.
 *
 * Design rules:
 *   - Every helper is NON-FATAL. Persistence must never break the interview
 *     flow, so failures are logged and swallowed exactly like logActivity().
 *   - Writes are idempotent thanks to the (interviewSessionId, round) unique
 *     constraint — an endpoint that fires twice updates one row.
 *   - If the candidate has no interview session (legacy data created before
 *     sessions existed) we skip silently rather than inventing one.
 */

export const ROUNDS = ["OA", "Technical", "HR"];

/** The interview session a round result should attach to: in-progress first. */
async function currentSession(userId) {
  return (
    (await prisma.interviewSession.findFirst({
      where: { userId, status: "in_progress" },
      orderBy: { startedAt: "desc" },
    })) ||
    (await prisma.interviewSession.findFirst({
      where: { userId },
      orderBy: { startedAt: "desc" },
    }))
  );
}

/**
 * Create or update this round's row for the candidate's current session.
 *
 * @param {string} userId
 * @param {"OA"|"Technical"|"HR"} round
 * @param {object} data - RoundResult columns to write (undefined keys ignored)
 * @returns {Promise<object|null>} the row, or null if nothing was written
 */
export async function saveRoundResult(userId, round, data = {}) {
  try {
    if (!ROUNDS.includes(round)) return null;

    const session = await currentSession(userId);
    if (!session) return null;

    // Drop undefined so a partial update never clobbers previously stored
    // fields (e.g. saving the report must not wipe the questions).
    const clean = Object.fromEntries(
      Object.entries(data).filter(([, v]) => v !== undefined)
    );

    return await prisma.roundResult.upsert({
      where: {
        interviewSessionId_round: {
          interviewSessionId: session.interviewSessionId,
          round,
        },
      },
      update: clean,
      create: {
        userId,
        interviewSessionId: session.interviewSessionId,
        round,
        ...clean,
      },
    });
  } catch (err) {
    console.error(`[saveRoundResult:${round}] non-fatal:`, err.message);
    return null;
  }
}

/**
 * Record that a round finished, on the session itself. Additive to
 * completedRounds (never removes), and advances currentRound to the next
 * round so a resumed interview lands in the right place.
 */
export async function markRoundCompleted(userId, round) {
  try {
    if (!ROUNDS.includes(round)) return;

    const session = await currentSession(userId);
    if (!session) return;

    const completed = Array.isArray(session.completedRounds) ? session.completedRounds : [];
    if (completed.includes(round)) return;

    const next = completed.concat(round);
    const pending = ROUNDS.find((r) => !next.includes(r));

    await prisma.interviewSession.update({
      where: { id: session.id },
      data: {
        completedRounds: next,
        currentRound: pending || session.currentRound,
      },
    });
  } catch (err) {
    console.error(`[markRoundCompleted:${round}] non-fatal:`, err.message);
  }
}

/** Read-only progress for the current session (server-side unlock gate). */
export async function getRoundProgress(userId) {
  const session = await currentSession(userId);
  if (!session) return { interview_session_id: null, completed_rounds: [], current_round: "OA" };

  return {
    interview_session_id: session.interviewSessionId,
    completed_rounds: Array.isArray(session.completedRounds) ? session.completedRounds : [],
    current_round: session.currentRound,
  };
}
