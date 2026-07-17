import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { submitTurn, getInterviewReport } from '../api';
import ConfirmSubmitModal from '../../components/ConfirmSubmitModal';
import { markRoundComplete, getProgress, ROUND_ORDER } from '../../services/roundProgress';

const API_BASE = import.meta.env.VITE_FASTAPI_URL || 'http://localhost:8000';

export default function InterviewChat({ sessionData, onBackToDashboard }) {
  const { token } = useAuth();
  const navigate = useNavigate();
  
  // Timer state
  const [timeLeft, setTimeLeft] = useState(() => {
    if (sessionData.roundType === 'OA') return 90 * 60;
    if (sessionData.roundType === 'HR') return 30 * 60;
    return 60 * 60; // Technical
  });

  // Flow views: 'chat' | 'report'
  const [viewState, setViewState] = useState('chat');

  // Chat conversation state
  const [history, setHistory] = useState([]); // Array of { question, answer, evaluation }
  const [currentQuestion, setCurrentQuestion] = useState('');
  const [currentAnswer, setCurrentAnswer] = useState('');
  const [isStreaming, setIsStreaming] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [latestEvaluation, setLatestEvaluation] = useState(null);
  const [error, setError] = useState('');

  // Report states
  const [report, setReport] = useState(null);
  const [loadingReport, setLoadingReport] = useState(false);

  // End Session confirmation modal (same UX as the OA round's End Test)
  const [showEndConfirm, setShowEndConfirm] = useState(false);

  // Auto-scroll ref
  const chatEndRef = useRef(null);

  // Auto scroll helper
  const scrollToBottom = () => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [currentQuestion, history, latestEvaluation, error]);

  // Countdown timer hook
  useEffect(() => {
    if (viewState !== 'chat') return;
    if (timeLeft <= 0) {
      // Time is up -> fetch report
      handleTransitionToReport();
      return;
    }

    const timer = setInterval(() => {
      setTimeLeft((prev) => prev - 1);
    }, 1000);

    return () => clearInterval(timer);
  }, [timeLeft, viewState]);

  // Timer formatter
  const formatTime = (seconds) => {
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = seconds % 60;
    
    const mStr = String(m).padStart(2, '0');
    const sStr = String(s).padStart(2, '0');
    
    if (h > 0) {
      return `${h}:${mStr}:${sStr}`;
    }
    return `${mStr}:${sStr}`;
  };

  const typingTimerRef = useRef(null);

  useEffect(() => {
    return () => {
      if (typingTimerRef.current) {
        clearInterval(typingTimerRef.current);
      }
    };
  }, []);

  const startTypingSimulation = (text, onComplete) => {
    if (typingTimerRef.current) {
      clearInterval(typingTimerRef.current);
    }

    setIsStreaming(true);
    setCurrentQuestion('');

    let index = 0;
    typingTimerRef.current = setInterval(() => {
      if (index >= text.length) {
        clearInterval(typingTimerRef.current);
        typingTimerRef.current = null;
        setIsStreaming(false);
        if (onComplete) onComplete();
        return;
      }
      
      // Render the absolute prefix (slice) instead of appending to previous
      // state — this is immune to state resets/races so no leading character
      // is ever dropped (e.g. "In your..." never becomes "n your...").
      index++;
      setCurrentQuestion(text.slice(0, index));
    }, 20); // 20ms per character
  };

  const fetchFirstQuestion = async () => {
    setIsStreaming(true);
    setCurrentQuestion('');
    setError('');

    try {
      const res = await submitTurn(token, sessionData.session_id, null);
      if (res.next_question) {
        startTypingSimulation(res.next_question);
      } else if (res.round_should_end) {
        handleTransitionToReport();
      }
    } catch (err) {
      setError(err.message || 'Unable to load the first question. Please check connection.');
      setIsStreaming(false);
    }
  };

  // Initial trigger for first question
  useEffect(() => {
    fetchFirstQuestion();
  }, []);

  // Submit response handler
  const handleAnswerSubmit = async (e) => {
    e.preventDefault();
    if (!currentAnswer.trim() || isSubmitting || isStreaming) return;

    setIsSubmitting(true);
    setError('');
    const answerToSend = currentAnswer.trim();
    setCurrentAnswer('');

    // Pre-insert candidate's answer into history
    const tempIndex = history.length;
    setHistory((prev) => [
      ...prev,
      {
        question: currentQuestion,
        answer: answerToSend,
        evaluation: null,
      },
    ]);
    
    const activeQuestion = currentQuestion;
    setCurrentQuestion('');

    try {
      const res = await submitTurn(token, sessionData.session_id, answerToSend);

      // Store evaluation in feedback card
      setLatestEvaluation(res.previous_evaluation);

      // Update history entry with actual evaluation
      setHistory((prev) => {
        const updated = [...prev];
        if (updated[tempIndex]) {
          updated[tempIndex].evaluation = res.previous_evaluation;
        }
        return updated;
      });

      if (res.round_should_end) {
        setIsSubmitting(false);
        handleTransitionToReport();
        return;
      }

      // Wait 2.5 seconds to read feedback, then clear feedback and type next question
      setTimeout(() => {
        setLatestEvaluation(null);
        if (res.next_question) {
          startTypingSimulation(res.next_question);
        }
      }, 2500);

    } catch (err) {
      setError(err.message || 'Failed to submit response. Please retry.');
      setCurrentAnswer(answerToSend);
      // Remove temporary item
      setHistory((prev) => prev.slice(0, -1));
      setCurrentQuestion(activeQuestion);
    } finally {
      setIsSubmitting(false);
    }
  };

  // Fetch final evaluation report
  const handleTransitionToReport = async () => {
    // Mark this round complete so the next round unlocks (Technical → HR).
    markRoundComplete(sessionData.roundType);
    setViewState('report');
    setLoadingReport(true);
    setError('');

    try {
      const reportData = await getInterviewReport(token, sessionData.session_id);
      setReport(reportData);
    } catch (err) {
      setError(err.message || 'Failed to fetch final readiness report.');
    } finally {
      setLoadingReport(false);
    }
  };

  // ─────────────────────────────────────────────────────────────────────────────
  // VIEW: 1. Live Chat
  // ─────────────────────────────────────────────────────────────────────────────
  if (viewState === 'chat') {
    return (
      <div className="min-h-screen flex flex-col pt-16 bg-surface-0">
        {/* Chat Sub-header (Stats & Timer) */}
        <div className="bg-surface-50/80 backdrop-blur border-b border-white/[0.06] sticky top-16 z-30">
          <div className="max-w-4xl mx-auto px-6 py-3 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-brand-500 animate-pulse" />
              <h2 className="text-sm font-bold text-text-primary">
                {sessionData.roundType} Practice Interview
              </h2>
              <span className="text-xs text-text-muted hidden sm:inline">—</span>
              <span className="text-xs text-text-secondary hidden sm:inline truncate max-w-[200px]">
                {sessionData.company}
              </span>
            </div>

            <div className="flex items-center gap-2">
              <div className="flex items-center gap-2 border border-white/[0.08] bg-surface-100 px-3 py-1 rounded-lg">
                <svg className="w-4 h-4 text-brand-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <span className={`text-xs font-mono font-bold tracking-wider ${timeLeft < 180 ? 'text-error animate-pulse' : 'text-text-primary'}`}>
                  {formatTime(timeLeft)}
                </span>
              </div>

              <button
                type="button"
                onClick={() => setShowEndConfirm(true)}
                className="px-4 py-1.5 rounded-lg font-semibold text-xs text-white bg-gradient-to-r from-error to-error/80
                           hover:opacity-90 transition-all duration-200 cursor-pointer"
              >
                End Session
              </button>
            </div>
          </div>
        </div>

        {/* End Session confirmation (same UX as the OA round) */}
        <ConfirmSubmitModal
          open={showEndConfirm}
          submitting={false}
          title="End Session?"
          message="Are you sure you want to end this interview? Your evaluation report will be generated from the answers so far."
          confirmLabel="End Session"
          onCancel={() => setShowEndConfirm(false)}
          onConfirm={() => {
            setShowEndConfirm(false);
            handleTransitionToReport();
          }}
        />

        {/* Chat Feed */}
        <div className="flex-1 max-w-4xl w-full mx-auto px-6 py-6 overflow-y-auto space-y-6 flex flex-col">
          {/* Informational initial bubble */}
          <div className="p-4 rounded-xl bg-surface-50 border border-white/[0.04] text-xs text-text-secondary">
            <span className="font-semibold text-text-primary">AI Interviewer ready.</span> Practice session started with targeted criteria. Answer each question clearly. Your scores dynamically scale difficulty.
          </div>

          {/* Render history exchanges */}
          {history.map((turn, index) => (
            <div key={index} className="space-y-4">
              {/* Question */}
              <div className="flex gap-4 items-start">
                <div className="w-8 h-8 rounded-lg bg-brand-500/20 border border-brand-500/20 flex items-center justify-center text-brand-300 font-bold text-sm shrink-0">
                  AI
                </div>
                <div className="flex-1 bg-surface-100/50 border border-white/[0.04] rounded-2xl p-4 text-sm text-text-primary leading-relaxed break-words whitespace-pre-wrap min-w-0">
                  {turn.question}
                </div>
              </div>

              {/* Answer */}
              <div className="flex gap-4 items-start justify-end">
                <div className="flex-1 bg-brand-500/10 border border-brand-500/25 rounded-2xl p-4 text-sm text-text-primary leading-relaxed text-right break-words whitespace-pre-wrap min-w-0">
                  {turn.answer}
                </div>
                <div className="w-8 h-8 rounded-lg bg-surface-200 border border-white/[0.08] flex items-center justify-center text-text-secondary font-bold text-sm shrink-0">
                  U
                </div>
              </div>

              {/* Score evaluation indicator */}
              {turn.evaluation && (
                <div className="flex gap-4 items-start pl-12">
                  <div className="flex-1 bg-surface-50/60 border border-white/[0.06] rounded-xl p-3 text-xs leading-relaxed">
                    <div className="flex items-center justify-between mb-1.5">
                      <span className="text-text-muted font-medium">Evaluation Feedback</span>
                      <span className={`px-2 py-0.5 rounded font-bold border ${
                        turn.evaluation.score >= 7 
                          ? 'bg-verified-bg text-verified border-verified/20' 
                          : turn.evaluation.score >= 4 
                            ? 'bg-unverified-bg text-unverified border-unverified/20' 
                            : 'bg-error-bg text-error border-error/20'
                      }`}>
                        Score: {turn.evaluation.score}/10
                      </span>
                    </div>
                    <p className="text-text-secondary italic">"{turn.evaluation.reasoning}"</p>
                  </div>
                </div>
              )}
            </div>
          ))}

          {/* Active Question Bubble (Streams progressively) */}
          {currentQuestion && (
            <div className="flex gap-4 items-start animate-fade-in">
              <div className="w-8 h-8 rounded-lg bg-brand-500/20 border border-brand-500/20 flex items-center justify-center text-brand-300 font-bold text-sm shrink-0">
                AI
              </div>
              <div className="flex-1 bg-surface-100/50 border border-white/[0.04] rounded-2xl p-4 text-sm text-text-primary leading-relaxed relative min-h-[50px] break-words whitespace-pre-wrap min-w-0">
                {currentQuestion}
                {isStreaming && (
                  <span className="inline-block w-1.5 h-4 bg-brand-400 ml-1 animate-pulse" />
                )}
              </div>
            </div>
          )}

          {/* Active Evaluation Banner (Waiting for feedback) */}
          {latestEvaluation && !currentQuestion && (
            <div className="flex gap-4 items-start pl-12 animate-fade-in">
              <div className="flex-1 bg-surface-50 border border-white/[0.06] rounded-xl p-3 text-xs">
                <div className="flex items-center justify-between mb-1.5">
                  <span className="text-text-muted font-medium">Evaluation Feedback</span>
                  <span className={`px-2 py-0.5 rounded font-bold border ${
                    latestEvaluation.score >= 7 
                      ? 'bg-verified-bg text-verified border-verified/20' 
                      : latestEvaluation.score >= 4 
                        ? 'bg-unverified-bg text-unverified border-unverified/20' 
                        : 'bg-error-bg text-error border-error/20'
                  }`}>
                    Score: {latestEvaluation.score}/10
                  </span>
                </div>
                <p className="text-text-secondary italic">"{latestEvaluation.reasoning}"</p>
              </div>
            </div>
          )}

          {/* Loading stream spinner */}
          {isStreaming && !currentQuestion && (
            <div className="flex gap-4 items-start animate-fade-in">
              <div className="w-8 h-8 rounded-lg bg-brand-500/20 border border-brand-500/20 flex items-center justify-center text-brand-300 font-bold text-sm shrink-0">
                AI
              </div>
              <div className="flex-1 bg-surface-100/30 border border-dashed border-white/[0.06] rounded-2xl p-4 text-sm text-text-muted italic flex items-center gap-2">
                <div className="w-4 h-4 rounded-full border-2 border-brand-500/20 border-t-brand-500 animate-spin-slow" />
                Interviewer is speaking...
              </div>
            </div>
          )}

          {/* Evaluating loader banner */}
          {isSubmitting && (
            <div className="flex gap-4 items-start justify-end animate-fade-in">
              <div className="flex-1 bg-surface-100/30 border border-dashed border-white/[0.06] rounded-2xl p-4 text-sm text-text-muted italic flex items-center justify-end gap-2">
                Evaluating answer response...
                <div className="w-4 h-4 rounded-full border-2 border-brand-500/20 border-t-brand-500 animate-spin-slow" />
              </div>
              <div className="w-8 h-8 rounded-lg bg-surface-200 border border-white/[0.08] flex items-center justify-center text-text-secondary font-bold text-sm shrink-0">
                U
              </div>
            </div>
          )}

          {/* Error Banner */}
          {error && (
            <div className="p-3 rounded-xl bg-error-bg border border-error/20 text-xs text-error animate-fade-in flex items-center gap-2">
              <svg className="w-4 h-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                <circle cx="12" cy="12" r="10" /><line x1="12" y1="8" x2="12" y2="12" /><line x1="12" y1="16" x2="12.01" y2="16" />
              </svg>
              <div className="flex-1">{error}</div>
              {error.includes('next') && (
                <button
                  onClick={fetchNextQuestion}
                  className="px-2 py-1 bg-error/20 text-error hover:bg-error/35 rounded transition-all font-semibold"
                >
                  Retry
                </button>
              )}
            </div>
          )}

          <div ref={chatEndRef} />
        </div>

        {/* Answer Bar Area */}
        <div className="bg-surface-50 border-t border-white/[0.06] p-4 sticky bottom-0 z-20">
          <div className="max-w-4xl mx-auto">
            <form onSubmit={handleAnswerSubmit} className="flex gap-3">
              <textarea
                value={currentAnswer}
                onChange={(e) => setCurrentAnswer(e.target.value)}
                placeholder={
                  isStreaming 
                    ? 'Wait for question to finish streaming...' 
                    : isSubmitting 
                      ? 'Interviewer is evaluating...' 
                      : 'Type your answer here...'
                }
                disabled={isStreaming || isSubmitting}
                rows="2"
                className="flex-1 px-4 py-2 rounded-xl bg-surface-100 border border-white/[0.08]
                           text-text-primary placeholder-text-muted text-sm
                           focus:outline-none focus:border-brand-500/50 focus:ring-1 focus:ring-brand-500/30
                           transition-all duration-200 resize-none disabled:opacity-50 disabled:cursor-not-allowed"
              />
              <button
                type="submit"
                disabled={!currentAnswer.trim() || isStreaming || isSubmitting}
                className="px-6 py-2 rounded-xl font-semibold text-sm text-white bg-gradient-to-r from-brand-500 to-brand-600
                           hover:from-brand-400 hover:to-brand-500 disabled:opacity-40 disabled:cursor-not-allowed
                           shadow-[0_0_15px_rgba(99,102,241,0.2)] hover:shadow-[0_0_20px_rgba(99,102,241,0.3)]
                           transition-all duration-300 self-end h-10 flex items-center justify-center shrink-0 cursor-pointer"
              >
                {isSubmitting ? (
                  <div className="w-5 h-5 rounded-full border-2 border-white/20 border-t-white animate-spin-slow" />
                ) : (
                  'Submit Answer'
                )}
              </button>
            </form>
          </div>
        </div>
      </div>
    );
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // VIEW: 2. Evaluation Report Screen
  // ─────────────────────────────────────────────────────────────────────────────
  if (viewState === 'report') {
    if (loadingReport) {
      return (
        <div className="min-h-screen flex items-center justify-center px-4 pt-16">
          <div className="text-center animate-fade-in-up">
            <div className="relative w-24 h-24 mx-auto mb-8">
              <div className="absolute inset-0 rounded-full border-2 border-brand-500/20" />
              <div className="absolute inset-0 rounded-full border-2 border-transparent border-t-brand-500 animate-spin-slow" />
              <div className="absolute inset-3 rounded-full bg-brand-500/10 animate-pulse-glow flex items-center justify-center">
                <svg className="w-8 h-8 text-brand-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.5">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
              </div>
            </div>
            <h2 className="text-xl font-bold text-text-primary mb-2">Compiling Readiness Report...</h2>
            <p className="text-text-secondary text-sm max-w-sm mx-auto">
              Please wait while Gemini evaluates your Q&A history and grades your technical profile.
            </p>
          </div>
        </div>
      );
    }

    if (!report) {
      return (
        <div className="min-h-screen flex items-center justify-center px-4 pt-16">
          <div className="text-center max-w-sm">
            <svg className="w-12 h-12 text-error mx-auto mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.5">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
            <h2 className="text-lg font-bold text-text-primary mb-2">Readiness Compilation Failed</h2>
            <p className="text-text-secondary text-sm mb-6">{error || 'An unexpected server error occurred.'}</p>
            <button
              onClick={handleTransitionToReport}
              className="py-2.5 px-6 rounded-xl font-semibold text-sm text-white bg-brand-500 hover:bg-brand-400 transition-all cursor-pointer"
            >
              Retry Compilation
            </button>
          </div>
        </div>
      );
    }

    const readinessScore = Math.round(report.overall_score * 10); // scale 0-10 to % or display as 0-100

    return (
      <div className="min-h-screen pt-24 pb-16 px-4 bg-surface-0">
        <div className="max-w-4xl mx-auto">
          {/* Header */}
          <div className="text-center mb-10 animate-fade-in-up">
            <h1 className="text-3xl font-extrabold text-text-primary mb-2 tracking-tight">
              Interview Evaluation Report
            </h1>
            <p className="text-text-secondary text-sm">
              Consolidated readiness insights for your targeted practice session.
            </p>
          </div>

          {/* Overall score card */}
          <div className="glass-strong rounded-2xl p-8 mb-8 animate-fade-in-up" style={{ animationDelay: '0.1s' }}>
            <div className="flex flex-col sm:flex-row items-center gap-8">
              {/* Progress Circle indicator */}
              <div className="relative w-32 h-32 shrink-0">
                <svg className="w-full h-full -rotate-90" viewBox="0 0 120 120">
                  <circle cx="60" cy="60" r="52" fill="none" stroke="rgba(255,255,255,0.05)" strokeWidth="8" />
                  <circle
                    cx="60" cy="60" r="52" fill="none"
                    stroke="url(#report-rate-gradient)"
                    strokeWidth="8"
                    strokeLinecap="round"
                    strokeDasharray={`${2 * Math.PI * 52}`}
                    strokeDashoffset={`${2 * Math.PI * 52 * (1 - report.overall_score / 10)}`}
                    style={{ transition: 'stroke-dashoffset 1.5s ease-out' }}
                  />
                  <defs>
                    <linearGradient id="report-rate-gradient" x1="0%" y1="0%" x2="100%" y2="0%">
                      <stop offset="0%" stopColor="#6366f1" />
                      <stop offset="100%" stopColor="#22c55e" />
                    </linearGradient>
                  </defs>
                </svg>
                <div className="absolute inset-0 flex flex-col items-center justify-center">
                  <span className="text-3xl font-extrabold text-text-primary">{readinessScore}%</span>
                  <span className="text-xs text-text-muted">Readiness</span>
                </div>
              </div>

              {/* Summary description */}
              <div className="flex-1 text-center sm:text-left">
                <h2 className="text-xl font-bold text-text-primary mb-2">Session Readiness Summary</h2>
                <p className="text-text-secondary text-sm leading-relaxed">
                  {report.readiness_summary}
                </p>
              </div>
            </div>
          </div>

          {/* Strengths & Gaps lists */}
          <div className="grid sm:grid-cols-2 gap-6 mb-8 animate-fade-in-up" style={{ animationDelay: '0.2s' }}>
            {/* Strengths */}
            <div className="glass-strong rounded-2xl p-6">
              <div className="flex items-center gap-2 mb-4 text-verified">
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <h3 className="text-sm font-semibold text-text-primary">Key Strengths</h3>
              </div>
              <ul className="space-y-3">
                {report.strengths?.map((str, idx) => (
                  <li key={idx} className="flex gap-2.5 items-start text-sm text-text-secondary leading-relaxed">
                    <span className="text-verified mt-1 shrink-0">•</span>
                    <span>{str}</span>
                  </li>
                ))}
                {(!report.strengths || report.strengths.length === 0) && (
                  <p className="text-xs text-text-muted italic">No specific strengths recorded.</p>
                )}
              </ul>
            </div>

            {/* Gaps */}
            <div className="glass-strong rounded-2xl p-6">
              <div className="flex items-center gap-2 mb-4 text-unverified">
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
                <h3 className="text-sm font-semibold text-text-primary">Identified Gaps</h3>
              </div>
              <ul className="space-y-3">
                {report.gaps?.map((gap, idx) => (
                  <li key={idx} className="flex gap-2.5 items-start text-sm text-text-secondary leading-relaxed">
                    <span className="text-unverified mt-1 shrink-0">•</span>
                    <span>{gap}</span>
                  </li>
                ))}
                {(!report.gaps || report.gaps.length === 0) && (
                  <p className="text-xs text-text-muted italic">No significant gaps identified.</p>
                )}
              </ul>
            </div>
          </div>

          {/* Recommended focus areas */}
          <div className="glass-strong rounded-2xl p-6 mb-8 animate-fade-in-up" style={{ animationDelay: '0.3s' }}>
            <div className="flex items-center gap-2 mb-4 text-brand-400">
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                <path strokeLinecap="round" strokeLinejoin="round" d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
              </svg>
              <h3 className="text-sm font-semibold text-text-primary">Recommended Focus Areas</h3>
            </div>
            <ul className="space-y-3">
              {report.recommended_focus_areas?.map((item, idx) => (
                <li key={idx} className="flex gap-2.5 items-start text-sm text-text-secondary leading-relaxed">
                  <span className="text-brand-400 mt-1 shrink-0">•</span>
                  <span>{item}</span>
                </li>
              ))}
            </ul>
          </div>

          {/* Action buttons */}
          <div className="flex flex-col sm:flex-row items-center justify-center gap-3 animate-fade-in-up" style={{ animationDelay: '0.4s' }}>
            {ROUND_ORDER.every((r) => getProgress()[r]) && (
              <button
                onClick={() => navigate('/interview/final-report')}
                className="py-3 px-8 rounded-xl font-semibold text-sm text-white bg-gradient-to-r from-verified to-verified/80
                           hover:opacity-90 shadow-[0_0_20px_rgba(34,197,94,0.25)] transition-all duration-300 cursor-pointer
                           flex items-center justify-center gap-2"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
                View Final Report
              </button>
            )}
            <button
              onClick={onBackToDashboard}
              className="py-3 px-8 rounded-xl font-semibold text-sm text-white bg-gradient-to-r from-brand-500 to-brand-600
                         hover:from-brand-400 hover:to-brand-500 shadow-[0_0_20px_rgba(99,102,241,0.2)]
                         hover:shadow-[0_0_30px_rgba(99,102,241,0.35)] transition-all duration-300 cursor-pointer"
            >
              Return to Dashboard
            </button>
          </div>
        </div>
      </div>
    );
  }

  return null;
}
