export default function ProfileResults({ data, onReset, onContinue }) {
  const {
    resume,
    github,
    verified_skills: verifiedSkills = [],
    unverified_skills: unverifiedSkills = [],
    verification_rate: verificationRate = 0,
  } = data;

  const ratePercent = Math.round(verificationRate * 100);

  return (
    <div className="min-h-screen pt-20 pb-16 px-4">
      <div className="max-w-5xl mx-auto">
        {/* Header */}
        <div className="text-center mb-10 animate-fade-in-up">
          <h1 className="text-3xl font-extrabold text-text-primary mb-2 tracking-tight">
            Profile Analysis Complete
          </h1>
          <p className="text-text-secondary text-sm">
            Here's how your resume claims stack up against your GitHub evidence.
          </p>
        </div>

        {/* Verification Rate Card */}
        <div className="glass-strong rounded-2xl p-8 mb-6 animate-fade-in-up" style={{ animationDelay: '0.1s' }}>
          <div className="flex flex-col sm:flex-row items-center gap-8">
            {/* Circular progress */}
            <div className="relative w-32 h-32 shrink-0">
              <svg className="w-full h-full -rotate-90" viewBox="0 0 120 120">
                <circle cx="60" cy="60" r="52" fill="none" stroke="rgba(255,255,255,0.05)" strokeWidth="8" />
                <circle
                  cx="60" cy="60" r="52" fill="none"
                  stroke="url(#rate-gradient)"
                  strokeWidth="8"
                  strokeLinecap="round"
                  strokeDasharray={`${2 * Math.PI * 52}`}
                  strokeDashoffset={`${2 * Math.PI * 52 * (1 - verificationRate)}`}
                  style={{ transition: 'stroke-dashoffset 1s ease-out' }}
                />
                <defs>
                  <linearGradient id="rate-gradient" x1="0%" y1="0%" x2="100%" y2="0%">
                    <stop offset="0%" stopColor="#6366f1" />
                    <stop offset="100%" stopColor="#22c55e" />
                  </linearGradient>
                </defs>
              </svg>
              <div className="absolute inset-0 flex flex-col items-center justify-center">
                <span className="text-3xl font-extrabold text-text-primary">{ratePercent}%</span>
                <span className="text-xs text-text-muted">Verified</span>
              </div>
            </div>

            {/* Summary */}
            <div className="flex-1 text-center sm:text-left">
              <h2 className="text-xl font-bold text-text-primary mb-1">Verification Rate</h2>
              <p className="text-text-secondary text-sm mb-4">
                {ratePercent >= 70
                  ? 'Strong match! Most of your resume skills are backed by GitHub evidence.'
                  : ratePercent >= 40
                    ? 'Moderate match. Some skills need more public evidence to verify.'
                    : 'Low match. Consider contributing more public code in your claimed skill areas.'}
              </p>
              <div className="flex gap-6">
                <div>
                  <p className="text-2xl font-bold text-verified">{verifiedSkills.length}</p>
                  <p className="text-xs text-text-muted">Verified</p>
                </div>
                <div>
                  <p className="text-2xl font-bold text-unverified">{unverifiedSkills.length}</p>
                  <p className="text-xs text-text-muted">Unverified</p>
                </div>
                <div>
                  <p className="text-2xl font-bold text-text-primary">{resume?.skills?.length || 0}</p>
                  <p className="text-xs text-text-muted">Total Skills</p>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Skills */}
        <div className="grid md:grid-cols-2 gap-6 mb-6">
          {/* Verified Skills */}
          <div className="glass-strong rounded-2xl p-6 animate-fade-in-up" style={{ animationDelay: '0.2s' }}>
            <div className="flex items-center gap-2 mb-4">
              <div className="w-6 h-6 rounded-full bg-verified/20 flex items-center justify-center">
                <svg className="w-3.5 h-3.5 text-verified" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                </svg>
              </div>
              <h3 className="text-sm font-semibold text-text-primary">Verified Skills</h3>
              <span className="text-xs text-text-muted ml-auto">{verifiedSkills.length} skills</span>
            </div>
            <div className="flex flex-wrap gap-2">
              {verifiedSkills.length > 0 ? (
                verifiedSkills.map((skill) => (
                  <span
                    key={skill}
                    className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium
                               bg-verified-bg text-verified border border-verified/20"
                  >
                    <svg className="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                    </svg>
                    {skill}
                  </span>
                ))
              ) : (
                <p className="text-sm text-text-muted">No skills verified yet</p>
              )}
            </div>
          </div>

          {/* Unverified Skills */}
          <div className="glass-strong rounded-2xl p-6 animate-fade-in-up" style={{ animationDelay: '0.3s' }}>
            <div className="flex items-center gap-2 mb-4">
              <div className="w-6 h-6 rounded-full bg-unverified/20 flex items-center justify-center">
                <svg className="w-3.5 h-3.5 text-unverified" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z" />
                </svg>
              </div>
              <h3 className="text-sm font-semibold text-text-primary">Unverified Skills</h3>
              <span className="text-xs text-text-muted ml-auto">{unverifiedSkills.length} skills</span>
            </div>
            <div className="flex flex-wrap gap-2">
              {unverifiedSkills.length > 0 ? (
                unverifiedSkills.map((skill) => (
                  <span
                    key={skill}
                    className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium
                               bg-unverified-bg text-unverified border border-unverified/20"
                  >
                    <svg className="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                      <circle cx="12" cy="12" r="10" />
                      <line x1="12" y1="8" x2="12" y2="12" />
                      <line x1="12" y1="16" x2="12.01" y2="16" />
                    </svg>
                    {skill}
                  </span>
                ))
              ) : (
                <p className="text-sm text-text-muted">All skills verified!</p>
              )}
            </div>
          </div>
        </div>

        {/* GitHub Repos */}
        {github?.repos?.length > 0 && (
          <div className="glass-strong rounded-2xl p-6 mb-6 animate-fade-in-up" style={{ animationDelay: '0.4s' }}>
            <div className="flex items-center gap-2 mb-5">
              <svg className="w-5 h-5 text-text-secondary" viewBox="0 0 24 24" fill="currentColor">
                <path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z" />
              </svg>
              <h3 className="text-sm font-semibold text-text-primary">GitHub Repositories</h3>
              <span className="text-xs text-text-muted ml-auto">{github.total_repos} repos · @{github.username}</span>
            </div>

            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {github.repos.map((repo) => (
                <div
                  key={repo.name}
                  className="p-4 rounded-xl bg-surface-100/50 border border-white/[0.05]
                             hover:border-brand-500/20 hover:bg-surface-100
                             transition-all duration-200 group"
                >
                  <div className="flex items-start justify-between mb-2">
                    <h4 className="text-sm font-semibold text-text-primary group-hover:text-brand-400 transition-colors truncate pr-2">
                      {repo.name}
                    </h4>
                    {repo.stars > 0 && (
                      <span className="flex items-center gap-1 text-xs text-text-muted shrink-0">
                        <svg className="w-3 h-3" viewBox="0 0 24 24" fill="currentColor">
                          <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
                        </svg>
                        {repo.stars}
                      </span>
                    )}
                  </div>

                  {repo.description && (
                    <p className="text-xs text-text-muted mb-3 line-clamp-2">{repo.description}</p>
                  )}

                  <div className="flex items-center justify-between">
                    <div className="flex flex-wrap gap-1">
                      {repo.languages?.slice(0, 3).map((lang) => (
                        <span
                          key={lang}
                          className="px-2 py-0.5 rounded-md text-[10px] font-medium bg-brand-500/10 text-brand-300 border border-brand-500/15"
                        >
                          {lang}
                        </span>
                      ))}
                      {repo.languages?.length > 3 && (
                        <span className="px-2 py-0.5 rounded-md text-[10px] font-medium text-text-muted">
                          +{repo.languages.length - 3}
                        </span>
                      )}
                    </div>
                    <span className="text-[10px] text-text-muted shrink-0 ml-2">
                      {repo.recent_commits} commits
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Resume Projects */}
        {resume?.projects?.length > 0 && (
          <div className="glass-strong rounded-2xl p-6 mb-6 animate-fade-in-up" style={{ animationDelay: '0.5s' }}>
            <div className="flex items-center gap-2 mb-5">
              <svg className="w-5 h-5 text-text-secondary" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                <path strokeLinecap="round" strokeLinejoin="round"
                  d="M2.25 12.75V12A2.25 2.25 0 014.5 9.75h15A2.25 2.25 0 0121.75 12v.75m-8.69-6.44l-2.12-2.12a1.5 1.5 0 00-1.061-.44H4.5A2.25 2.25 0 002.25 6v12a2.25 2.25 0 002.25 2.25h15A2.25 2.25 0 0021.75 18V9a2.25 2.25 0 00-2.25-2.25h-5.379a1.5 1.5 0 01-1.06-.44z"
                />
              </svg>
              <h3 className="text-sm font-semibold text-text-primary">Resume Projects</h3>
              <span className="text-xs text-text-muted ml-auto">{resume.projects.length} projects</span>
            </div>

            <div className="space-y-3">
              {resume.projects.map((project, i) => (
                <div
                  key={i}
                  className="p-4 rounded-xl bg-surface-100/50 border border-white/[0.05]"
                >
                  <h4 className="text-sm font-semibold text-text-primary mb-1">{project.name}</h4>
                  {project.description && (
                    <p className="text-xs text-text-muted mb-2">{project.description}</p>
                  )}
                  {project.tech_stack && (
                    <p className="text-xs text-text-secondary">
                      <span className="text-text-muted">Tech:</span> {project.tech_stack}
                    </p>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Resume Meta (experience + education) */}
        <div className="grid sm:grid-cols-2 gap-6 mb-8 animate-fade-in-up" style={{ animationDelay: '0.6s' }}>
          {/* Experience */}
          {resume?.experience_years != null && (
            <div className="glass-strong rounded-2xl p-6">
              <div className="flex items-center gap-2 mb-3">
                <svg className="w-5 h-5 text-text-secondary" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                  <path strokeLinecap="round" strokeLinejoin="round"
                    d="M20.25 14.15v4.25c0 1.094-.787 2.036-1.872 2.18-2.087.277-4.216.42-6.378.42s-4.291-.143-6.378-.42c-1.085-.144-1.872-1.086-1.872-2.18v-4.25m16.5 0a2.18 2.18 0 00.75-1.661V8.706c0-1.081-.768-2.015-1.837-2.175a48.114 48.114 0 00-3.413-.387m4.5 8.006c-.194.165-.42.295-.673.38A23.978 23.978 0 0112 15.75c-2.648 0-5.195-.429-7.577-1.22a2.016 2.016 0 01-.673-.38m0 0A2.18 2.18 0 013 12.489V8.706c0-1.081.768-2.015 1.837-2.175a48.111 48.111 0 013.413-.387m7.5 0V5.25A2.25 2.25 0 0013.5 3h-3a2.25 2.25 0 00-2.25 2.25v.894m7.5 0a48.667 48.667 0 00-7.5 0"
                  />
                </svg>
                <h3 className="text-sm font-semibold text-text-primary">Experience</h3>
              </div>
              <p className="text-3xl font-extrabold text-text-primary">
                {resume.experience_years}
                <span className="text-lg font-medium text-text-muted ml-1">years</span>
              </p>
            </div>
          )}

          {/* Education */}
          {resume?.education?.length > 0 && (
            <div className="glass-strong rounded-2xl p-6">
              <div className="flex items-center gap-2 mb-3">
                <svg className="w-5 h-5 text-text-secondary" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                  <path strokeLinecap="round" strokeLinejoin="round"
                    d="M4.26 10.147a60.436 60.436 0 00-.491 6.347A48.627 48.627 0 0112 20.904a48.627 48.627 0 018.232-4.41 60.46 60.46 0 00-.491-6.347m-15.482 0a50.57 50.57 0 00-2.658-.813A59.905 59.905 0 0112 3.493a59.902 59.902 0 0110.399 5.84c-.896.248-1.783.52-2.658.814m-15.482 0A50.697 50.697 0 0112 13.489a50.702 50.702 0 017.74-3.342"
                  />
                </svg>
                <h3 className="text-sm font-semibold text-text-primary">Education</h3>
              </div>
              <ul className="space-y-1.5">
                {resume.education.map((edu, i) => (
                  <li key={i} className="text-sm text-text-secondary">{edu}</li>
                ))}
              </ul>
            </div>
          )}
        </div>

        {/* Navigation / Actions */}
        <div className="flex flex-col sm:flex-row items-center justify-center gap-4 animate-fade-in-up" style={{ animationDelay: '0.7s' }}>
          <button
            onClick={onReset}
            className="inline-flex items-center gap-2 px-6 py-3 rounded-xl font-medium text-sm
                       text-text-secondary hover:text-text-primary
                       bg-white/[0.03] hover:bg-white/[0.06]
                       border border-white/[0.08] hover:border-white/[0.15]
                       transition-all duration-200 cursor-pointer w-full sm:w-auto justify-center"
          >
            <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path strokeLinecap="round" strokeLinejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0l3.181 3.183a8.25 8.25 0 0013.803-3.7M4.031 9.865a8.25 8.25 0 0113.803-3.7l3.181 3.182" />
            </svg>
            Analyze Another Profile
          </button>

          <button
            onClick={onContinue}
            className="inline-flex items-center gap-2 px-8 py-3 rounded-xl font-semibold text-sm
                       text-white bg-gradient-to-r from-brand-500 to-brand-600
                       hover:from-brand-400 hover:to-brand-500
                       shadow-[0_0_20px_rgba(99,102,241,0.2)] hover:shadow-[0_0_30px_rgba(99,102,241,0.35)]
                       transition-all duration-300 cursor-pointer w-full sm:w-auto justify-center"
          >
            Continue to Interview Prep
            <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
            </svg>
          </button>
        </div>
      </div>
    </div>
  );
}
