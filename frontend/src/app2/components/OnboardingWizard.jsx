import { useState, useRef } from 'react';
import { useAuth } from '../context/AuthContext';
import { buildProfile } from '../api';
import { resetInterviewProgress } from '../../services/roundProgress';

/**
 * Clean GitHub username from a URL if the user pastes a full URL.
 * Example: https://github.com/octocat/ -> octocat
 */
const extractGithubUsername = (input) => {
  if (!input) return '';
  const trimmed = input.trim();
  if (trimmed.toLowerCase().includes('github.com/')) {
    try {
      const parts = trimmed.split('github.com/');
      if (parts.length > 1) {
        return parts[1].split('/')[0].split('?')[0].split('#')[0];
      }
    } catch {
      return trimmed;
    }
  }
  return trimmed;
};

export default function OnboardingWizard({ onResult }) {
  const { token } = useAuth();
  const fileInputRef = useRef(null);

  // Wizard state
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [dragActive, setDragActive] = useState(false);

  // Form Fields
  const [file, setFile] = useState(null);
  const [githubInput, setGithubInput] = useState('');
  const [collegeName, setCollegeName] = useState('');
  const [linkedinProfile, setLinkedinProfile] = useState('');
  const [leetcodeProfile, setLeetcodeProfile] = useState('');
  const [otherCodingProfile, setOtherCodingProfile] = useState('');
  const [graduationYear, setGraduationYear] = useState('');
  const [cgpa, setCgpa] = useState('');

  // Drag & Drop handlers
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
      setFile(droppedFile);
      setError('');
    } else {
      setError('Please upload a PDF file.');
    }
  };

  const handleFileSelect = (e) => {
    const selected = e.target.files?.[0];
    if (selected) {
      if (selected.type === 'application/pdf') {
        setFile(selected);
        setError('');
      } else {
        setError('Please upload a PDF file.');
        setFile(null);
      }
    }
  };

  // Navigating between steps with local validation
  const goToNextStep = (e) => {
    e.preventDefault();
    setError('');

    if (!file) {
      setError('Please upload your resume (PDF).');
      return;
    }
    if (!githubInput.trim()) {
      setError('Please enter your GitHub Username or Profile URL.');
      return;
    }

    setStep(2);
  };

  const goToPrevStep = () => {
    setError('');
    setStep(1);
  };

  // Submit flow
  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    // Extra validation for step 2
    if (!collegeName.trim()) {
      setError('College Name is required.');
      return;
    }
    if (cgpa) {
      const parsedCgpa = parseFloat(cgpa);
      if (isNaN(parsedCgpa) || parsedCgpa < 0 || parsedCgpa > 10) {
        setError('Please enter a valid CGPA between 0 and 10.');
        return;
      }
    }

    setLoading(true);
    const cleanedGithubUsername = extractGithubUsername(githubInput);

    try {
      const extraFields = {
        collegeName: collegeName.trim(),
        linkedinProfile: linkedinProfile.trim(),
        leetcodeProfile: leetcodeProfile.trim(),
        otherCodingProfile: otherCodingProfile.trim(),
        graduationYear: graduationYear.trim(),
        cgpa: cgpa ? parseFloat(cgpa) : undefined,
      };

      const data = await buildProfile(token, file, cleanedGithubUsername, extraFields);
      // Build Profile begins a brand-new interview session — clear any previous
      // interview's client state so all 3 rounds (OA → Technical → HR) start fresh.
      resetInterviewProgress();
      onResult(data);
    } catch (err) {
      setError(err.message || 'Something went wrong while building your profile.');
      setLoading(false);
    }
  };

  // Rendering loading state overlay
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center px-4 pt-16">
        <div className="text-center animate-fade-in-up">
          {/* Animated loader */}
          <div className="relative w-24 h-24 mx-auto mb-8">
            {/* Outer ring */}
            <div className="absolute inset-0 rounded-full border-2 border-brand-500/20" />
            {/* Spinning ring */}
            <div className="absolute inset-0 rounded-full border-2 border-transparent border-t-brand-500 animate-spin-slow" />
            {/* Inner glow */}
            <div className="absolute inset-3 rounded-full bg-brand-500/10 animate-pulse-glow flex items-center justify-center">
              <svg className="w-8 h-8 text-brand-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                <path strokeLinecap="round" strokeLinejoin="round"
                  d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z"
                />
              </svg>
            </div>
          </div>

          <h2 className="text-xl font-bold text-text-primary mb-2">Building your profile…</h2>
          <p className="text-text-secondary text-sm max-w-sm mx-auto mb-6">
            We&apos;re analyzing your resume with AI and scanning your GitHub activity. This usually takes 10–15 seconds.
          </p>

          {/* Progress steps */}
          <div className="space-y-3 max-w-xs mx-auto text-left">
            {['Extracting resume data', 'Scanning GitHub repos', 'Cross-referencing skills'].map((stepName, i) => (
              <div key={stepName} className="flex items-center gap-3 animate-fade-in" style={{ animationDelay: `${i * 0.3}s` }}>
                <div className="w-5 h-5 rounded-full border-2 border-brand-500/40 flex items-center justify-center">
                  <div className="w-2 h-2 rounded-full bg-brand-500 animate-pulse" />
                </div>
                <span className="text-sm text-text-secondary">{stepName}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-4 pt-16 pb-12">
      <div className="w-full max-w-xl animate-fade-in-up">
        {/* Onboarding Wizard Header */}
        <div className="text-center mb-8">
          <h1 className="text-3xl font-extrabold text-text-primary mb-3 tracking-tight">
            Complete Your Profile
          </h1>
          <p className="text-text-secondary text-sm max-w-md mx-auto">
            {step === 1 
              ? 'Step 1: Upload your resume and connect your coding presence.' 
              : 'Step 2: Add your academic and professional details.'}
          </p>
          
          {/* Progress Bar Indicators */}
          <div className="flex items-center justify-center gap-2 mt-4">
            <span className={`w-8 h-1.5 rounded-full transition-colors duration-300 ${step >= 1 ? 'bg-brand-500' : 'bg-surface-300'}`} />
            <span className={`w-8 h-1.5 rounded-full transition-colors duration-300 ${step >= 2 ? 'bg-brand-500' : 'bg-surface-300'}`} />
          </div>
        </div>

        {/* Wizard Card Wrapper */}
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

          {step === 1 ? (
            /* ================= STEP 1: THE UPLOAD HUB ================= */
            <form onSubmit={goToNextStep} className="space-y-6">
              {/* File upload zone */}
              <div>
                <label className="block text-sm font-medium text-text-secondary mb-2">
                  Resume (PDF)
                </label>
                <div
                  onDragEnter={handleDrag}
                  onDragLeave={handleDrag}
                  onDragOver={handleDrag}
                  onDrop={handleDrop}
                  onClick={() => fileInputRef.current?.click()}
                  className={`relative flex flex-col items-center justify-center py-10 px-6 rounded-xl border-2 border-dashed cursor-pointer transition-all duration-200
                    ${dragActive
                      ? 'border-brand-500 bg-brand-500/5'
                      : file
                        ? 'border-verified/40 bg-verified/5'
                        : 'border-white/[0.1] hover:border-brand-500/40 hover:bg-white/[0.02]'
                    }`}
                >
                  <input
                    ref={fileInputRef}
                    id="resume-upload"
                    type="file"
                    accept=".pdf"
                    onChange={handleFileSelect}
                    className="hidden"
                  />

                  {file ? (
                    <>
                      <svg className="w-8 h-8 text-verified mb-2" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4" />
                        <circle cx="12" cy="12" r="10" />
                      </svg>
                      <p className="text-sm font-medium text-text-primary text-center truncate max-w-xs">{file.name}</p>
                      <p className="text-xs text-text-muted mt-1">{(file.size / 1024).toFixed(0)} KB — Click to replace</p>
                    </>
                  ) : (
                    <>
                      <svg className="w-8 h-8 text-text-muted mb-2" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                        <path strokeLinecap="round" strokeLinejoin="round"
                          d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5m-13.5-9L12 3m0 0l4.5 4.5M12 3v13.5"
                        />
                      </svg>
                      <p className="text-sm text-text-secondary text-center">
                        <span className="text-brand-400 font-medium">Click to upload</span> or drag and drop
                      </p>
                      <p className="text-xs text-text-muted mt-1">PDF only, max 10MB</p>
                    </>
                  )}
                </div>
              </div>

              {/* GitHub Handle / URL Input */}
              <div>
                <label htmlFor="github-input" className="block text-sm font-medium text-text-secondary mb-1.5">
                  GitHub Profile (Username or URL)
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none">
                    <svg className="w-4 h-4 text-text-muted" viewBox="0 0 24 24" fill="currentColor">
                      <path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z" />
                    </svg>
                  </div>
                  <input
                    id="github-input"
                    type="text"
                    value={githubInput}
                    onChange={(e) => setGithubInput(e.target.value)}
                    placeholder="octocat or https://github.com/octocat"
                    autoComplete="off"
                    className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-surface-100 border border-white/[0.08]
                               text-text-primary placeholder-text-muted text-sm
                               focus:outline-none focus:border-brand-500/50 focus:ring-1 focus:ring-brand-500/30
                               transition-all duration-200"
                  />
                </div>
              </div>

              {/* Navigation button */}
              <button
                type="submit"
                className="w-full py-3 px-4 rounded-xl font-semibold text-sm text-white
                           bg-gradient-to-r from-brand-500 to-brand-600
                           hover:from-brand-400 hover:to-brand-500
                           shadow-[0_0_20px_rgba(99,102,241,0.2)]
                           hover:shadow-[0_0_30px_rgba(99,102,241,0.35)]
                           transition-all duration-300 cursor-pointer
                           flex items-center justify-center gap-2"
              >
                Next Step
                <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                </svg>
              </button>
            </form>
          ) : (
            /* ================= STEP 2: PROFILE DETAILS FORMULATION ================= */
            <form onSubmit={handleSubmit} className="space-y-5">
              {/* College Name */}
              <div>
                <label htmlFor="college-name" className="block text-sm font-medium text-text-secondary mb-1.5">
                  College Name *
                </label>
                <input
                  id="college-name"
                  type="text"
                  required
                  value={collegeName}
                  onChange={(e) => setCollegeName(e.target.value)}
                  placeholder="Massachusetts Institute of Technology"
                  className="w-full px-4 py-2.5 rounded-xl bg-surface-100 border border-white/[0.08]
                             text-text-primary placeholder-text-muted text-sm
                             focus:outline-none focus:border-brand-500/50 focus:ring-1 focus:ring-brand-500/30
                             transition-all duration-200"
                />
              </div>

              {/* LinkedIn Profile */}
              <div>
                <label htmlFor="linkedin-profile" className="block text-sm font-medium text-text-secondary mb-1.5">
                  LinkedIn Profile URL
                </label>
                <input
                  id="linkedin-profile"
                  type="url"
                  value={linkedinProfile}
                  onChange={(e) => setLinkedinProfile(e.target.value)}
                  placeholder="https://linkedin.com/in/username"
                  className="w-full px-4 py-2.5 rounded-xl bg-surface-100 border border-white/[0.08]
                             text-text-primary placeholder-text-muted text-sm
                             focus:outline-none focus:border-brand-500/50 focus:ring-1 focus:ring-brand-500/30
                             transition-all duration-200"
                />
              </div>

              {/* Coding Profiles Grid */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {/* LeetCode Profile */}
                <div>
                  <label htmlFor="leetcode-profile" className="block text-sm font-medium text-text-secondary mb-1.5">
                    LeetCode Profile URL
                  </label>
                  <input
                    id="leetcode-profile"
                    type="url"
                    value={leetcodeProfile}
                    onChange={(e) => setLeetcodeProfile(e.target.value)}
                    placeholder="https://leetcode.com/u/username"
                    className="w-full px-4 py-2.5 rounded-xl bg-surface-100 border border-white/[0.08]
                               text-text-primary placeholder-text-muted text-sm
                               focus:outline-none focus:border-brand-500/50 focus:ring-1 focus:ring-brand-500/30
                               transition-all duration-200"
                  />
                </div>

                {/* Other Coding Profile */}
                <div>
                  <label htmlFor="other-coding" className="block text-sm font-medium text-text-secondary mb-1.5">
                    Other Coding Profile URL
                  </label>
                  <input
                    id="other-coding"
                    type="url"
                    value={otherCodingProfile}
                    onChange={(e) => setOtherCodingProfile(e.target.value)}
                    placeholder="https://codeforces.com/profile/username"
                    className="w-full px-4 py-2.5 rounded-xl bg-surface-100 border border-white/[0.08]
                               text-text-primary placeholder-text-muted text-sm
                               focus:outline-none focus:border-brand-500/50 focus:ring-1 focus:ring-brand-500/30
                               transition-all duration-200"
                  />
                </div>
              </div>

              {/* Graduation Info Grid */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {/* Year (Graduation) */}
                <div>
                  <label htmlFor="grad-year" className="block text-sm font-medium text-text-secondary mb-1.5">
                    Graduation Year
                  </label>
                  <input
                    id="grad-year"
                    type="number"
                    min="1980"
                    max="2035"
                    value={graduationYear}
                    onChange={(e) => setGraduationYear(e.target.value)}
                    placeholder="2027"
                    className="w-full px-4 py-2.5 rounded-xl bg-surface-100 border border-white/[0.08]
                               text-text-primary placeholder-text-muted text-sm
                               focus:outline-none focus:border-brand-500/50 focus:ring-1 focus:ring-brand-500/30
                               transition-all duration-200"
                  />
                </div>

                {/* CGPA */}
                <div>
                  <label htmlFor="cgpa" className="block text-sm font-medium text-text-secondary mb-1.5">
                    CGPA / Grade
                  </label>
                  <input
                    id="cgpa"
                    type="number"
                    step="0.01"
                    min="0"
                    max="10"
                    value={cgpa}
                    onChange={(e) => setCgpa(e.target.value)}
                    placeholder="9.5"
                    className="w-full px-4 py-2.5 rounded-xl bg-surface-100 border border-white/[0.08]
                               text-text-primary placeholder-text-muted text-sm
                               focus:outline-none focus:border-brand-500/50 focus:ring-1 focus:ring-brand-500/30
                               transition-all duration-200"
                  />
                </div>
              </div>

              {/* Navigation buttons */}
              <div className="flex flex-col sm:flex-row gap-3 pt-2">
                <button
                  type="button"
                  onClick={goToPrevStep}
                  className="w-full sm:w-1/3 py-3 px-4 rounded-xl font-semibold text-sm text-text-secondary
                             bg-surface-200 hover:bg-surface-300 border border-white/[0.06]
                             transition-all duration-200 cursor-pointer flex items-center justify-center gap-2"
                >
                  <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
                  </svg>
                  Back
                </button>
                <button
                  type="submit"
                  className="w-full sm:w-2/3 py-3 px-4 rounded-xl font-semibold text-sm text-white
                             bg-gradient-to-r from-brand-500 to-brand-600
                             hover:from-brand-400 hover:to-brand-500
                             shadow-[0_0_20px_rgba(99,102,241,0.2)]
                             hover:shadow-[0_0_30px_rgba(99,102,241,0.35)]
                             transition-all duration-300 cursor-pointer
                             flex items-center justify-center gap-2"
                >
                  <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 13.5l10.5-11.25L12 10.5h8.25L9.75 21.75 12 13.5H3.75z" />
                  </svg>
                  Build Profile
                </button>
              </div>
            </form>
          )}
        </div>

        {/* Secure badge */}
        <div className="flex items-center justify-center gap-2 mt-6 text-text-muted">
          <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
            <path d="M7 11V7a5 5 0 0110 0v4" />
          </svg>
          <span className="text-xs">All connections are encrypted and parsed securely</span>
        </div>
      </div>
    </div>
  );
}
