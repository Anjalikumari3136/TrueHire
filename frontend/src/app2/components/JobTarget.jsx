import { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { startInterview } from '../api';
import { getProgress, isRoundUnlocked, prerequisiteOf, ROUND_ORDER } from '../../services/roundProgress';

// Friendly labels for the "already completed" popup.
const ROUND_LABELS = {
  OA: 'OA (Online Assessment)',
  Technical: 'Technical Depth',
  HR: 'HR Behavioral',
};

/**
 * JobTarget component.
 * Allows candidates to define target job context and select their interview round,
 * followed by a rich mock analysis transition before initiating the live session.
 */
export default function JobTarget({ profileData, onBack, onSubmit, initialStep, initialForm }) {
  const { token } = useAuth();
  const navigate = useNavigate();
  const fileInputRef = useRef(null);

  // Flow states: 'form' | 'round_select' | 'loading'
  // initialStep lets the flow reopen directly on 'round_select' when the
  // candidate returns from the OA round.
  const [flowStep, setFlowStep] = useState(initialStep || 'form');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // Form Fields (prefilled from initialForm when returning from the OA round)
  const [company, setCompany] = useState(initialForm?.company || '');
  const [jobDescription, setJobDescription] = useState(initialForm?.jobDescription || '');
  const [experience, setExperience] = useState(initialForm?.experience || '0-1 years');
  const [newFile, setNewFile] = useState(null);
  const [usePreExistingResume, setUsePreExistingResume] = useState(!!profileData?.resume);
  const [dragActive, setDragActive] = useState(false);

  // Round Selection
  const [roundType, setRoundType] = useState(initialForm?.roundType || ''); // 'OA' | 'Technical' | 'HR'

  // Animated Checklist States
  const [checklistIndex, setChecklistIndex] = useState(0);

  // "You already completed this round" popup (holds the round id, or null)
  const [completedNotice, setCompletedNotice] = useState(null);

  // Drag & drop handlers
  const handleDrag = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(e.type === 'dragenter' || e.type === 'dragover');
  };

  const handleDrop = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    const droppedFile = e.dataTransfer.files?.[0];
    if (droppedFile?.type === 'application/pdf') {
      setNewFile(droppedFile);
      setError('');
    } else {
      setError('Please upload a PDF file.');
    }
  };

  const handleFileSelect = (e) => {
    const selected = e.target.files?.[0];
    if (selected) {
      if (selected.type === 'application/pdf') {
        setNewFile(selected);
        setError('');
      } else {
        setError('Please upload a PDF file.');
        setNewFile(null);
      }
    }
  };

  const handleFormSubmit = (e) => {
    e.preventDefault();
    setError('');

    if (!company.trim()) {
      setError('Company name is required.');
      return;
    }
    if (!jobDescription.trim()) {
      setError('Job Description is required.');
      return;
    }

    setFlowStep('round_select');
  };

  // Run the mock loading checklist sequence and API call in parallel
  const handleStartInterview = async () => {
    if (!roundType) return;

    // Block re-attempting a round that is already completed.
    if (getProgress()[roundType]) {
      setCompletedNotice(roundType);
      return;
    }

    // OA round uses the standalone coding interface on its own route.
    // Technical / HR keep their existing live-session flow below.
    if (roundType === 'OA') {
      // Persist enough context so we can return the candidate to this exact
      // "Select Interview Round" screen after the OA round finishes.
      sessionStorage.setItem(
        'truehire_flow_ctx',
        JSON.stringify({
          profileData,
          company: company.trim(),
          jobDescription: jobDescription.trim(),
          experience,
          roundType: 'OA',
        })
      );
      navigate('/interview/oa');
      return;
    }

    setError('');
    setFlowStep('loading');
    setChecklistIndex(0);

    // Timeline of checks
    const interval = setInterval(() => {
      setChecklistIndex((prev) => {
        if (prev >= 3) {
          clearInterval(interval);
          return 3;
        }
        return prev + 1;
      });
    }, 700);

    const apiPromise = startInterview(token, {
      roundType,
      company: company.trim(),
      jobDescription: jobDescription.trim(),
      experience,
      candidateProfile: profileData,
    });

    const delayPromise = new Promise((resolve) => setTimeout(resolve, 2400));

    try {
      // Wait for both the API call to resolve and the minimum visual checklist duration (2.4s)
      const [apiResult] = await Promise.all([apiPromise, delayPromise]);
      clearInterval(interval);
      
      if (onSubmit) {
        onSubmit({
          session_id: apiResult.session_id,
          round: apiResult.round,
          roundType,
          company: company.trim(),
          jobDescription: jobDescription.trim(),
          experience,
        });
      }
    } catch (err) {
      clearInterval(interval);
      setError(err.message || 'Failed to start interview session. Please try again.');
      setFlowStep('round_select');
    }
  };

  const isFormValid = company.trim() && jobDescription.trim();

  // ─────────────────────────────────────────────────────────────────────────────
  // 1. Rendering target details form
  // ─────────────────────────────────────────────────────────────────────────────
  if (flowStep === 'form') {
    return (
      <div className="min-h-screen flex items-center justify-center px-4 pt-20 pb-12">
        <div className="w-full max-w-xl animate-fade-in-up">
          {/* Header */}
          <div className="text-center mb-8">
            <h1 className="text-3xl font-extrabold text-text-primary mb-3 tracking-tight">
              Target Job Details
            </h1>
            <p className="text-text-secondary text-sm max-w-md mx-auto">
              Provide the company and job description details to tailor the practice interview specifically to this role.
            </p>
          </div>

          {/* Card */}
          <div className="glass-strong rounded-2xl p-8 relative overflow-hidden">
            <div className="absolute top-0 inset-x-0 h-px bg-gradient-to-r from-transparent via-brand-400/30 to-transparent" />

            {error && (
              <div className="flex items-start gap-3 p-3 mb-6 rounded-xl bg-error-bg border border-error/20 animate-fade-in">
                <svg className="w-5 h-5 text-error shrink-0 mt-0.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <circle cx="12" cy="12" r="10" />
                  <line x1="15" y1="9" x2="9" y2="15" />
                  <line x1="9" y1="9" x2="15" y2="15" />
                </svg>
                <p className="text-sm text-error">{error}</p>
              </div>
            )}

            <form onSubmit={handleFormSubmit} className="space-y-6">
              {/* Resume upload/pre-filled check */}
              <div>
                <label className="block text-sm font-medium text-text-secondary mb-2">
                  Resume (Optional)
                </label>

                {usePreExistingResume ? (
                  <div className="flex items-center justify-between p-4 rounded-xl border border-verified/20 bg-verified/5 transition-all duration-200">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-lg bg-verified/10 flex items-center justify-center text-verified">
                        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4" />
                          <circle cx="12" cy="12" r="10" />
                        </svg>
                      </div>
                      <div>
                        <p className="text-sm font-semibold text-text-primary">Resume Linked</p>
                        <p className="text-xs text-text-muted">Already parsed from profile building step</p>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => setUsePreExistingResume(false)}
                      className="text-xs font-semibold text-brand-400 hover:text-brand-300 transition-colors bg-transparent border-none cursor-pointer"
                    >
                      Replace Resume
                  </button>
                  </div>
                ) : (
                  <div className="space-y-2">
                    <div
                      onDragEnter={handleDrag}
                      onDragLeave={handleDrag}
                      onDragOver={handleDrag}
                      onDrop={handleDrop}
                      onClick={() => fileInputRef.current?.click()}
                      className={`relative flex flex-col items-center justify-center py-6 px-6 rounded-xl border-2 border-dashed cursor-pointer transition-all duration-200
                        ${dragActive
                          ? 'border-brand-500 bg-brand-500/5'
                          : newFile
                            ? 'border-verified/40 bg-verified/5'
                            : 'border-white/[0.1] hover:border-brand-500/40 hover:bg-white/[0.02]'
                        }`}
                    >
                      <input
                        ref={fileInputRef}
                        type="file"
                        accept=".pdf"
                        onChange={handleFileSelect}
                        className="hidden"
                      />

                      {newFile ? (
                        <>
                          <svg className="w-6 h-6 text-verified mb-1" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4" />
                            <circle cx="12" cy="12" r="10" />
                          </svg>
                          <p className="text-xs font-semibold text-text-primary text-center truncate max-w-xs">{newFile.name}</p>
                          <p className="text-[10px] text-text-muted mt-0.5">{(newFile.size / 1024).toFixed(0)} KB — Click to replace</p>
                        </>
                      ) : (
                        <>
                          <svg className="w-6 h-6 text-text-muted mb-1" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                            <path strokeLinecap="round" strokeLinejoin="round"
                              d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5m-13.5-9L12 3m0 0l4.5 4.5M12 3v13.5"
                            />
                          </svg>
                          <p className="text-xs text-text-secondary text-center">
                            <span className="text-brand-400 font-medium">Click to upload resume</span> or drop PDF
                          </p>
                        </>
                      )}
                    </div>
                    {profileData?.resume && (
                      <div className="text-right">
                        <button
                          type="button"
                          onClick={() => setUsePreExistingResume(true)}
                          className="text-[10px] text-text-muted hover:text-brand-400 font-medium transition-colors bg-transparent border-none cursor-pointer"
                        >
                          ← Use pre-existing resume
                        </button>
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Company field */}
              <div>
                <label htmlFor="company" className="block text-sm font-medium text-text-secondary mb-1.5">
                  Company *
                </label>
                <input
                  id="company"
                  type="text"
                  required
                  value={company}
                  onChange={(e) => setCompany(e.target.value)}
                  placeholder="e.g. Google, Razorpay, TCS"
                  className="w-full px-4 py-2.5 rounded-xl bg-surface-100 border border-white/[0.08]
                             text-text-primary placeholder-text-muted text-sm
                             focus:outline-none focus:border-brand-500/50 focus:ring-1 focus:ring-brand-500/30
                             transition-all duration-200"
                />
              </div>

              {/* JD field */}
              <div>
                <label htmlFor="jd" className="block text-sm font-medium text-text-secondary mb-1.5">
                  Job Description (JD) *
                </label>
                <textarea
                  id="jd"
                  required
                  rows="5"
                  value={jobDescription}
                  onChange={(e) => setJobDescription(e.target.value)}
                  placeholder="Paste the job description here"
                  className="w-full px-4 py-2.5 rounded-xl bg-surface-100 border border-white/[0.08]
                             text-text-primary placeholder-text-muted text-sm
                             focus:outline-none focus:border-brand-500/50 focus:ring-1 focus:ring-brand-500/30
                             transition-all duration-200 resize-y"
                />
              </div>

              {/* Experience field */}
              <div>
                <label htmlFor="experience" className="block text-sm font-medium text-text-secondary mb-1.5">
                  Experience *
                </label>
                <select
                  id="experience"
                  value={experience}
                  onChange={(e) => setExperience(e.target.value)}
                  className="w-full px-4 py-2.5 rounded-xl bg-surface-100 border border-white/[0.08]
                             text-text-primary text-sm
                             focus:outline-none focus:border-brand-500/50 focus:ring-1 focus:ring-brand-500/30
                             transition-all duration-200 cursor-pointer"
                >
                  <option value="0-1 years">0-1 years</option>
                  <option value="1-3 years">1-3 years</option>
                  <option value="3+ years">3+ years</option>
                </select>
              </div>

              {/* Buttons */}
              <div className="flex flex-col sm:flex-row gap-3 pt-2">
                <button
                  type="button"
                  onClick={onBack}
                  className="w-full sm:w-1/3 py-3 px-4 rounded-xl font-semibold text-sm text-text-secondary
                             bg-surface-200 hover:bg-surface-300 border border-white/[0.06]
                             transition-all duration-200 cursor-pointer flex items-center justify-center gap-2"
                >
                  Back to Analysis
                </button>
                <button
                  type="submit"
                  disabled={!isFormValid}
                  className="w-full sm:w-2/3 py-3 px-4 rounded-xl font-semibold text-sm text-white
                             bg-gradient-to-r from-brand-500 to-brand-600
                             hover:from-brand-400 hover:to-brand-500
                             disabled:opacity-50 disabled:cursor-not-allowed
                             shadow-[0_0_20px_rgba(99,102,241,0.2)]
                             hover:shadow-[0_0_30px_rgba(99,102,241,0.35)]
                             transition-all duration-300 cursor-pointer
                             flex items-center justify-center gap-2"
                >
                  Continue to Interview
                </button>
              </div>
            </form>
          </div>
        </div>
      </div>
    );
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // 2. Rendering round selection screen
  // ─────────────────────────────────────────────────────────────────────────────
  if (flowStep === 'round_select') {
    const rounds = [
      { id: 'OA', name: 'OA (Online Assessment)', duration: '90 min', desc: 'Foundational coding, algorithms, and system structure screening.' },
      { id: 'Technical', name: 'Technical Depth', duration: '60 min', desc: 'Deep dive into projects, codebase decision tradeoffs, and skills evidence.' },
      { id: 'HR', name: 'HR Behavioral', duration: '30 min', desc: 'Focus on teamwork, adaptability, communication, and project leadership.' }
    ];

    // Rounds must be taken in order (OA → Technical → HR); a round stays locked
    // until the previous one is completed.
    const progress = getProgress();
    const selectedUnlocked = roundType ? isRoundUnlocked(roundType, progress) : false;
    const allRoundsComplete = ROUND_ORDER.every((r) => progress[r]);

    return (
      <div className="min-h-screen flex items-center justify-center px-4 pt-20 pb-12">
        <div className="w-full max-w-lg animate-fade-in-up">
          {/* Header */}
          <div className="text-center mb-8">
            <h1 className="text-3xl font-extrabold text-text-primary mb-3 tracking-tight">
              Select Interview Round
            </h1>
            <p className="text-text-secondary text-sm max-w-sm mx-auto">
              Choose the round format you wish to practice. The AI interviewer will adapt its tone and question set accordingly.
            </p>
          </div>

          <div className="glass-strong rounded-2xl p-8 relative overflow-hidden">
            <div className="absolute top-0 inset-x-0 h-px bg-gradient-to-r from-transparent via-brand-400/30 to-transparent" />

            {error && (
              <div className="flex items-start gap-3 p-3 mb-5 rounded-xl bg-error-bg border border-error/20 animate-fade-in">
                <svg className="w-5 h-5 text-error shrink-0 mt-0.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <circle cx="12" cy="12" r="10" />
                  <line x1="15" y1="9" x2="9" y2="15" />
                  <line x1="9" y1="9" x2="15" y2="15" />
                </svg>
                <p className="text-sm text-error">{error}</p>
              </div>
            )}

            <div className="space-y-4 mb-6">
              {rounds.map((r) => {
                const unlocked = isRoundUnlocked(r.id, progress);
                const completed = !!progress[r.id];
                const isSelected = roundType === r.id;
                const prereq = prerequisiteOf(r.id);
                return (
                  <div
                    key={r.id}
                    onClick={() => {
                      if (completed) { setCompletedNotice(r.id); return; }
                      if (unlocked) setRoundType(r.id);
                    }}
                    className={`p-4 rounded-xl border transition-all duration-300 relative group
                      ${!unlocked
                        ? 'border-white/[0.06] bg-surface-200/30 opacity-60 cursor-not-allowed'
                        : isSelected
                          ? 'border-brand-500 bg-brand-500/[0.04] shadow-[0_0_20px_rgba(99,102,241,0.1)] cursor-pointer'
                          : 'border-white/[0.08] hover:border-brand-500/30 hover:bg-white/[0.01] cursor-pointer'
                      }`}
                  >
                    <div className="flex items-start justify-between gap-2 mb-1">
                      <h3 className={`text-sm font-bold transition-colors flex items-center gap-1.5 ${isSelected ? 'text-brand-400' : unlocked ? 'text-text-primary group-hover:text-brand-400' : 'text-text-muted'}`}>
                        {!unlocked && (
                          <svg className="w-3.5 h-3.5 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <rect x="5" y="11" width="14" height="10" rx="2" />
                            <path strokeLinecap="round" strokeLinejoin="round" d="M8 11V7a4 4 0 018 0v4" />
                          </svg>
                        )}
                        {r.name}
                      </h3>
                      <div className="flex items-center gap-2 shrink-0">
                        {completed && (
                          <span className="text-xs px-2 py-0.5 rounded-md font-medium border bg-verified/10 text-verified border-verified/25">
                            Completed
                          </span>
                        )}
                        <span className={`text-xs px-2 py-0.5 rounded-md font-medium border
                          ${isSelected
                            ? 'bg-brand-500/20 text-brand-300 border-brand-500/20'
                            : 'bg-surface-200 text-text-muted border-white/[0.06]'
                          }`}
                        >
                          {r.duration}
                        </span>
                      </div>
                    </div>
                    <p className="text-xs text-text-secondary leading-relaxed">{r.desc}</p>
                    {!unlocked && prereq && (
                      <p className="text-[11px] text-text-muted mt-2 flex items-center gap-1">
                        <svg className="w-3 h-3 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <rect x="5" y="11" width="14" height="10" rx="2" />
                          <path strokeLinecap="round" strokeLinejoin="round" d="M8 11V7a4 4 0 018 0v4" />
                        </svg>
                        Complete the {prereq} round to unlock.
                      </p>
                    )}
                  </div>
                );
              })}
            </div>

            {allRoundsComplete && (
              <button
                type="button"
                onClick={() => navigate('/interview/final-report')}
                className="w-full mb-4 py-3 px-4 rounded-xl font-semibold text-sm text-white
                           bg-gradient-to-r from-verified to-verified/80 hover:opacity-90
                           shadow-[0_0_20px_rgba(34,197,94,0.25)] transition-all duration-300 cursor-pointer
                           flex items-center justify-center gap-2"
              >
                <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
                View Final Report
              </button>
            )}

            <div className="flex gap-3">
              <button
                type="button"
                onClick={() => setFlowStep('form')}
                className="w-1/3 py-3 px-4 rounded-xl font-semibold text-sm text-text-secondary
                           bg-surface-200 hover:bg-surface-300 border border-white/[0.06]
                           transition-all duration-200 cursor-pointer flex items-center justify-center gap-2"
              >
                Back
              </button>
              <button
                type="button"
                disabled={!roundType || !selectedUnlocked}
                onClick={handleStartInterview}
                className="w-2/3 py-3 px-4 rounded-xl font-semibold text-sm text-white
                           bg-gradient-to-r from-brand-500 to-brand-600
                           hover:from-brand-400 hover:to-brand-500
                           disabled:opacity-50 disabled:cursor-not-allowed
                           shadow-[0_0_20px_rgba(99,102,241,0.2)]
                           hover:shadow-[0_0_30px_rgba(99,102,241,0.35)]
                           transition-all duration-300 cursor-pointer
                           flex items-center justify-center gap-2"
              >
                Start Interview
                <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                </svg>
              </button>
            </div>
          </div>
        </div>

        {/* "Already completed" popup */}
        {completedNotice && (
          <div className="fixed inset-0 z-[1000] flex items-center justify-center px-4 bg-black/60 backdrop-blur-sm animate-fade-in">
            <div className="w-full max-w-md glass-strong rounded-2xl p-7 relative overflow-hidden animate-fade-in-up">
              <div className="absolute top-0 inset-x-0 h-px bg-gradient-to-r from-transparent via-brand-400/30 to-transparent" />

              <div className="w-12 h-12 rounded-xl flex items-center justify-center mb-4 bg-verified/10 text-verified">
                <svg className="w-6 h-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>

              <h2 className="text-lg font-bold text-text-primary mb-2">Round already completed</h2>
              <p className="text-sm text-text-secondary leading-relaxed mb-5">
                You have already completed the{' '}
                <span className="font-semibold text-text-primary">
                  {ROUND_LABELS[completedNotice] || completedNotice}
                </span>{' '}
                round. You cannot attempt it again.
              </p>

              <button
                type="button"
                onClick={() => setCompletedNotice(null)}
                className="w-full py-3 px-4 rounded-xl font-semibold text-sm text-white
                           bg-gradient-to-r from-brand-500 to-brand-600 hover:from-brand-400 hover:to-brand-500
                           shadow-[0_0_20px_rgba(99,102,241,0.2)] transition-all duration-300 cursor-pointer"
              >
                Got it
              </button>
            </div>
          </div>
        )}
      </div>
    );
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // 3. Rendering cosmetic loading screen
  // ─────────────────────────────────────────────────────────────────────────────
  if (flowStep === 'loading') {
    const checklist = [
      'Reviewing candidate resume data...',
      'Cross-checking with GitHub evidence...',
      'Assembling customized question set...'
    ];

    return (
      <div className="min-h-screen flex items-center justify-center px-4 pt-16">
        <div className="text-center animate-fade-in-up">
          {/* Animated loader */}
          <div className="relative w-24 h-24 mx-auto mb-8">
            <div className="absolute inset-0 rounded-full border-2 border-brand-500/20" />
            <div className="absolute inset-0 rounded-full border-2 border-transparent border-t-brand-500 animate-spin-slow" />
            <div className="absolute inset-3 rounded-full bg-brand-500/10 animate-pulse-glow flex items-center justify-center">
              <svg className="w-8 h-8 text-brand-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5 animate-pulse">
                <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904L9 21L14.907 18m4.917-11.847l-1.077 1.077m2.736-2.29a2.25 2.25 0 10-3.181-3.18l-12.06 12.06a2.25 2.25 0 00-.57 1.03l-1 4a1.125 1.125 0 001.373 1.37l4-1c.3-.075.57-.223.77-.42l12.06-12.061z" />
              </svg>
            </div>
          </div>

          <h2 className="text-xl font-bold text-text-primary mb-2">Analyzing Target & Profile...</h2>
          <p className="text-text-secondary text-sm max-w-sm mx-auto mb-8">
            Our AI engine is processing your targeting options to calibrate the active agent context.
          </p>

          {/* Sequential checklist items */}
          <div className="space-y-4 max-w-xs mx-auto text-left">
            {checklist.map((item, idx) => {
              const isDone = checklistIndex > idx;
              const isActive = checklistIndex === idx;

              return (
                <div
                  key={item}
                  className={`flex items-center gap-3 transition-opacity duration-300 ${
                    isDone || isActive ? 'opacity-100' : 'opacity-30'
                  }`}
                >
                  <div className="flex-shrink-0">
                    {isDone ? (
                      <div className="w-5 h-5 rounded-full bg-verified/10 border border-verified/30 flex items-center justify-center text-verified animate-fade-in">
                        <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                        </svg>
                      </div>
                    ) : isActive ? (
                      <div className="w-5 h-5 rounded-full border-2 border-brand-500/40 border-t-brand-500 animate-spin-slow flex items-center justify-center" />
                    ) : (
                      <div className="w-5 h-5 rounded-full border border-white/10" />
                    )}
                  </div>
                  <span className={`text-sm ${isDone ? 'text-verified font-medium' : isActive ? 'text-text-primary font-medium' : 'text-text-secondary'}`}>
                    {item}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    );
  }

  return null;
}
