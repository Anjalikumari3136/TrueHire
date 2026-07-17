const API_BASE = import.meta.env.VITE_FASTAPI_URL || 'http://localhost:8000';

/**
 * Build a candidate profile by uploading a resume PDF and GitHub username.
 * @param {string} token - JWT auth token
 * @param {File} file - PDF resume file
 * @param {string} githubUsername - GitHub username
 * @returns {Promise<object>} Profile data
 */
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
    res = await fetch(`${API_BASE}/build-profile`, {
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
 * Start a new practice interview session.
 */
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

/**
 * Submit the turn response (answers previous question and/or fetches next question).
 */
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

/**
 * Retrieve the final structured round report.
 */
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
