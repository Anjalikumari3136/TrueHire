const API_BASE = import.meta.env.VITE_FASTAPI_URL || 'http://localhost:8000';
// Express base — Build Profile is proxied through Express so a new InterviewSession
// is created per résumé upload (the AI work still runs in FastAPI/LangGraph).
const EXPRESS_BASE = import.meta.env.VITE_API_URL || 'http://localhost:5000';

export async function buildProfile(token, file, githubUsername, extraFields = {}) {
  const formData = new FormData();
  formData.append('file', file);
  formData.append('github_username', githubUsername);

  if (extraFields.collegeName) formData.append('college_name', extraFields.collegeName);
  if (extraFields.linkedinProfile) formData.append('linkedin_profile', extraFields.linkedinProfile);
  if (extraFields.leetcodeProfile) formData.append('leetcode_profile', extraFields.leetcodeProfile);
  if (extraFields.otherCodingProfile) formData.append('other_coding_profile', extraFields.otherCodingProfile);
  if (extraFields.graduationYear) formData.append('graduation_year', extraFields.graduationYear);
  if (extraFields.cgpa) formData.append('cgpa', extraFields.cgpa);

  let res;
  try {
    res = await fetch(`${EXPRESS_BASE}/api/interview/build-profile`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
      },
      body: formData,
    });
  } catch {
    throw new Error(
      'Unable to reach the server. Please check that the backend is running and try again.'
    );
  }

  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    const message =
      data.detail ||
      data.message ||
      `Request failed (${res.status})`;
    throw new Error(message);
  }

  return res.json();
}

/**
 * Resume the pending interview WITHOUT re-uploading the résumé. Returns the
 * previously-analyzed profile + progress so the flow can jump to round selection.
 */
export async function resumeInterview(token) {
  const res = await fetch(`${EXPRESS_BASE}/api/interview/resume`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.message || data.detail || `Unable to resume interview (${res.status})`);
  }
  return res.json();
}

/**
 * Durably persist a completed Technical/HR round (transcript + report).
 *
 * Those rounds are driven straight against the FastAPI service, which keeps the
 * conversation and the round report in process memory only — a restart used to
 * lose both. Express owns the database, so we hand it the result here.
 *
 * Fire-and-forget by design: this NEVER throws, so a persistence failure cannot
 * interrupt the candidate's interview or block the report screen.
 */
export async function persistRoundResult(token, { round, aiSessionId, transcript, report, timeTakenSeconds }) {
  try {
    await fetch(`${EXPRESS_BASE}/api/interview/round-result`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        round,
        ai_session_id: aiSessionId,
        transcript,
        report,
        time_taken_seconds: timeTakenSeconds,
      }),
    });
  } catch {
    /* non-fatal — the round result simply is not persisted this time */
  }
}

export async function startInterview(token, { roundType, company, jobDescription, experience, candidateProfile }) {
  let res;
  try {
    res = await fetch(`${API_BASE}/api/interview/start`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        round_type: roundType,
        company,
        job_description: jobDescription,
        experience,
        candidate_profile: candidateProfile,
      }),
    });
  } catch {
    throw new Error('Unable to reach the server. Please check that the backend is running and try again.');
  }

  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.detail || data.message || `Failed to start interview session (${res.status})`);
  }

  return res.json();
}

export async function submitTurn(token, sessionId, answerText = null) {
  let res;
  try {
    res = await fetch(`${API_BASE}/api/interview/turn`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        session_id: sessionId,
        answer_text: answerText,
      }),
    });
  } catch {
    throw new Error('Unable to reach the server. Please check that the backend is running and try again.');
  }

  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.detail || data.message || `Failed to process interview turn (${res.status})`);
  }

  return res.json();
}

export async function getInterviewReport(token, sessionId) {
  let res;
  try {
    res = await fetch(`${API_BASE}/api/interview/report?session_id=${sessionId}`, {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });
  } catch {
    throw new Error('Unable to reach the server. Please check that the backend is running and try again.');
  }

  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.detail || data.message || `Failed to retrieve final report (${res.status})`);
  }

  return res.json();
}
