import { useCallback, useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import QuestionPanel from "../components/QuestionPanel";
import LanguageSelector from "../components/LanguageSelector";
import CodingEditor from "../components/CodingEditor";
import QuestionNavigator from "../components/QuestionNavigator";
import Timer from "../components/Timer";
import ConfirmSubmitModal from "../components/ConfirmSubmitModal";
import { startOA, submitOA, getOAReport } from "../services/oaApi";
import { markRoundComplete } from "../services/roundProgress";
import RoundReportView, {
  RoundReportLoading,
  RoundReportError,
} from "../app2/components/RoundReportView";

/**
 * OAPage — complete Online Assessment workflow.
 *
 * Flow: React → Express (JWT verify + proxy) → FastAPI → Gemini.
 * On mount it starts (or resumes) the session, then renders 5 personalized
 * questions with a Monaco editor, a 90-minute timer, per-question code buffers,
 * autosave, an unload guard, and a confirm-to-submit flow.
 */

const LANGUAGES = [
  { id: "python", label: "Python" },
  { id: "cpp", label: "C++" },
  { id: "java", label: "Java" },
  { id: "javascript", label: "JavaScript" },
];

const STORAGE_KEY = "truehire_oa_state";

export default function OAPage() {
  const navigate = useNavigate();

  // Session / lifecycle
  const [status, setStatus] = useState("loading"); // loading | error | active | submitting | report
  const [oaReport, setOaReport] = useState(null);
  const [reportError, setReportError] = useState("");
  const [errorMsg, setErrorMsg] = useState("");
  const [session, setSession] = useState(null); // { session_id, questions, duration_minutes, started_at }

  // Working state
  const [language, setLanguage] = useState("python");
  const [codeMap, setCodeMap] = useState({}); // { [questionId]: { python, cpp, java, javascript } }
  const [currentIndex, setCurrentIndex] = useState(0);

  // UI
  const [showConfirm, setShowConfirm] = useState(false);
  const [unanswered, setUnanswered] = useState([]);
  const [toast, setToast] = useState(false);

  const submittedRef = useRef(false);

  const questions = session?.questions ?? [];
  const currentQuestion = questions[currentIndex];
  const currentQid = currentQuestion?.id;

  // ── Build the initial per-question / per-language code buffers ──────────────
  const seedCodeMap = useCallback((qs) => {
    const map = {};
    for (const q of qs) {
      const starter = q.starterCode || {};
      map[q.id] = {
        python: starter.python || "",
        cpp: starter.cpp || "",
        java: starter.java || "",
        javascript: starter.javascript || "",
      };
    }
    return map;
  }, []);

  // ── Start / resume the session on mount (STEP 1, 15, 16, 17) ───────────────
  const loadSession = useCallback(async () => {
    setStatus("loading");
    setErrorMsg("");
    try {
      const data = await startOA();
      setSession(data);

      // Restore autosaved code if it belongs to this exact session (STEP 14).
      let restored = null;
      try {
        const raw = sessionStorage.getItem(STORAGE_KEY);
        if (raw) {
          const parsed = JSON.parse(raw);
          if (parsed.session_id === data.session_id) restored = parsed;
        }
      } catch {
        restored = null;
      }

      if (restored) {
        setCodeMap(restored.codeMap || seedCodeMap(data.questions));
        setLanguage(restored.language || "python");
        setCurrentIndex(restored.currentIndex || 0);
      } else {
        setCodeMap(seedCodeMap(data.questions));
        setLanguage("python");
        setCurrentIndex(0);
      }

      setStatus("active");
    } catch (err) {
      setErrorMsg(
        err.response?.data?.message ||
          err.message ||
          "Unable to generate assessment."
      );
      setStatus("error");
    }
  }, [seedCodeMap]);

  useEffect(() => {
    loadSession();
  }, [loadSession]);

  // ── Editor change for the current (question, language) buffer ──────────────
  const handleCodeChange = (val) => {
    if (!currentQid) return;
    setCodeMap((prev) => ({
      ...prev,
      [currentQid]: { ...prev[currentQid], [language]: val },
    }));
  };

  const currentCode = currentQid ? codeMap[currentQid]?.[language] ?? "" : "";

  // ── Which questions are attempted (code differs from the starter) ──────────
  const isAnswered = useCallback(
    (q) => {
      const code = (codeMap[q.id]?.[language] ?? "").trim();
      const starter = (q.starterCode?.[language] ?? "").trim();
      return code !== "" && code !== starter;
    },
    [codeMap, language]
  );

  const answeredFlags = questions.map(isAnswered);

  // ── Autosave every 5 seconds (STEP 14) ─────────────────────────────────────
  const persistRef = useRef({});
  persistRef.current = {
    session_id: session?.session_id,
    codeMap,
    language,
    currentIndex,
  };
  useEffect(() => {
    if (status !== "active") return undefined;
    const id = setInterval(() => {
      const snap = persistRef.current;
      if (snap.session_id) {
        sessionStorage.setItem(STORAGE_KEY, JSON.stringify(snap));
      }
    }, 5000);
    return () => clearInterval(id);
  }, [status]);

  // ── Warn on refresh / tab close while the test is active (STEP 13) ─────────
  useEffect(() => {
    if (status !== "active") return undefined;
    const handler = (e) => {
      e.preventDefault();
      e.returnValue = "";
      return "";
    };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [status]);

  // ── Submit / end the assessment (STEP 10, 11, 12) ──────────────────────────
  const doSubmit = useCallback(async () => {
    if (submittedRef.current || !session) return;
    submittedRef.current = true;
    setStatus("submitting");

    const endedAt = new Date().toISOString();
    const startMs = new Date(session.started_at).getTime();
    const timeTaken = Math.max(0, Math.floor((Date.now() - startMs) / 1000));

    const payload = {
      session_id: session.session_id,
      language,
      question_ids: questions.map((q) => q.id),
      answers: questions.map((q) => ({
        question_id: q.id,
        code: codeMap[q.id]?.[language] ?? "",
      })),
      started_at: session.started_at,
      ended_at: endedAt,
      time_taken_seconds: timeTaken,
    };

    try {
      await submitOA(payload);
      markRoundComplete("OA"); // unlocks the Technical round
      sessionStorage.removeItem(STORAGE_KEY);
      setShowConfirm(false);

      // Automatically generate + show the OA evaluation report, mirroring the
      // Technical round (which shows its report right after the round ends).
      setStatus("report");
      setReportError("");
      try {
        setOaReport(await getOAReport());
      } catch (err) {
        setReportError(
          err.response?.data?.message || err.message || "Failed to generate the OA report."
        );
      }
      return;
    } catch (err) {
      submittedRef.current = false;
      setStatus("active");
      setShowConfirm(false);
      setErrorMsg(
        err.response?.data?.message || err.message || "Failed to submit assessment."
      );
    }
  }, [session, language, questions, codeMap, navigate]);

  // Timer reaching 00:00 auto-ends the test (STEP 7).
  const handleTimeExpire = useCallback(() => {
    doSubmit();
  }, [doSubmit]);

  // End Test button → compute unanswered warning, then open modal (STEP 8, 9).
  const handleEndTest = () => {
    const missing = questions
      .map((q, i) => (isAnswered(q) ? null : `Question ${i + 1}`))
      .filter(Boolean);
    setUnanswered(missing);
    setShowConfirm(true);
  };

  // ── Loading state (STEP 16) ────────────────────────────────────────────────
  // ── OA evaluation report (same UI/UX as the Technical round report) ────────
  if (status === "report") {
    if (reportError) {
      return (
        <RoundReportError
          message={reportError}
          onRetry={async () => {
            setReportError("");
            setOaReport(null);
            try {
              setOaReport(await getOAReport());
            } catch (err) {
              setReportError(
                err.response?.data?.message || err.message || "Failed to generate the OA report."
              );
            }
          }}
        />
      );
    }
    if (!oaReport) {
      return (
        <RoundReportLoading
          title="Compiling OA Report..."
          subtitle="Please wait while Gemini evaluates your submitted code and grades your assessment."
        />
      );
    }
    return (
      <RoundReportView
        report={oaReport}
        title="OA Evaluation Report"
        subtitle="Consolidated insights from your Online Assessment submission."
        scoreScale={100}
        actions={
          <div className="flex flex-col sm:flex-row items-center justify-center gap-3 animate-fade-in-up" style={{ animationDelay: "0.4s" }}>
            <button
              onClick={() => {
                sessionStorage.setItem("truehire_return_round_select", "1");
                navigate("/dashboard");
              }}
              className="py-3 px-8 rounded-xl font-semibold text-sm text-white bg-gradient-to-r from-brand-500 to-brand-600
                         hover:from-brand-400 hover:to-brand-500 shadow-[0_0_20px_rgba(99,102,241,0.2)]
                         hover:shadow-[0_0_30px_rgba(99,102,241,0.35)] transition-all duration-300 cursor-pointer
                         flex items-center justify-center gap-2"
            >
              Continue to Next Round
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
              </svg>
            </button>
            <button
              onClick={() => navigate("/home")}
              className="py-3 px-8 rounded-xl font-semibold text-sm text-text-primary border border-white/10 hover:bg-white/5 transition-all duration-300 cursor-pointer"
            >
              Return to Dashboard
            </button>
          </div>
        }
      />
    );
  }

  if (status === "loading") {
    return (
      <div className="min-h-screen flex items-center justify-center px-4">
        <div className="text-center animate-fade-in-up">
          <div className="relative w-20 h-20 mx-auto mb-6">
            <div className="absolute inset-0 rounded-full border-2 border-brand-500/20" />
            <div className="absolute inset-0 rounded-full border-2 border-transparent border-t-brand-500 animate-spin-slow" />
          </div>
          <h2 className="text-xl font-bold text-text-primary mb-2">
            Generating Personalized Assessment…
          </h2>
          <p className="text-text-secondary text-sm max-w-sm mx-auto">
            Our AI is crafting 5 coding questions tailored to your skills, projects and experience.
          </p>
        </div>
      </div>
    );
  }

  // ── Error state (STEP 17) ──────────────────────────────────────────────────
  if (status === "error") {
    return (
      <div className="min-h-screen flex items-center justify-center px-4">
        <div className="text-center max-w-sm animate-fade-in-up">
          <div className="w-14 h-14 rounded-2xl bg-error/10 text-error flex items-center justify-center mx-auto mb-5">
            <svg className="w-7 h-7" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="12" cy="12" r="10" />
              <line x1="15" y1="9" x2="9" y2="15" />
              <line x1="9" y1="9" x2="15" y2="15" />
            </svg>
          </div>
          <h2 className="text-xl font-bold text-text-primary mb-2">Unable to generate assessment.</h2>
          <p className="text-text-secondary text-sm mb-6">{errorMsg}</p>
          <div className="flex gap-3 justify-center">
            <button
              type="button"
              onClick={() => navigate("/dashboard")}
              className="py-2.5 px-5 rounded-xl font-semibold text-sm text-text-secondary
                         bg-surface-200 hover:bg-surface-300 border border-white/[0.06]
                         transition-all duration-200 cursor-pointer"
            >
              Back
            </button>
            <button
              type="button"
              onClick={loadSession}
              className="py-2.5 px-5 rounded-xl font-semibold text-sm text-white
                         bg-gradient-to-r from-brand-500 to-brand-600 hover:from-brand-400 hover:to-brand-500
                         shadow-[0_0_20px_rgba(99,102,241,0.2)] transition-all duration-300 cursor-pointer"
            >
              Retry
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ── Active assessment ──────────────────────────────────────────────────────
  return (
    <div className="min-h-screen px-4 pt-6 pb-12">
      {/* Ambient background glow (matches the dashboard flow) */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden -z-10">
        <div className="absolute top-[-20%] left-[-10%] w-[600px] h-[600px] rounded-full bg-brand-700/[0.07] blur-[120px]" />
        <div className="absolute bottom-[-20%] right-[-10%] w-[500px] h-[500px] rounded-full bg-brand-500/[0.05] blur-[100px]" />
      </div>

      <div className="max-w-7xl mx-auto animate-fade-in-up">
        {/* Top bar: title + timer + End Test (STEP 7, 8) */}
        <div className="flex items-center justify-between gap-4 mb-5 flex-wrap">
          <div>
            <h1 className="text-xl font-extrabold text-text-primary tracking-tight">
              Online Assessment
            </h1>
            <p className="text-xs text-text-muted">Coding Round · 5 Questions</p>
          </div>

          <div className="flex items-center gap-3">
            {session?.started_at && (
              <Timer
                startedAt={session.started_at}
                durationMinutes={session.duration_minutes || 90}
                onExpire={handleTimeExpire}
              />
            )}
            <button
              type="button"
              onClick={handleEndTest}
              className="py-2.5 px-4 rounded-xl font-semibold text-sm text-white
                         bg-gradient-to-r from-error to-error/80 hover:opacity-90
                         transition-all duration-200 cursor-pointer"
            >
              End Test
            </button>
          </div>
        </div>

        {errorMsg && (
          <div className="flex items-start gap-3 p-3 mb-4 rounded-xl bg-error-bg border border-error/20">
            <p className="text-sm text-error">{errorMsg}</p>
          </div>
        )}

        {/* Two-column layout: question | editor */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5 mb-5">
          <QuestionPanel question={currentQuestion} index={currentIndex} total={questions.length} />

          <div className="glass-strong rounded-2xl p-4 relative overflow-hidden flex flex-col">
            <div className="absolute top-0 inset-x-0 h-px bg-gradient-to-r from-transparent via-brand-400/30 to-transparent" />

            <div className="flex items-center justify-between mb-3">
              <LanguageSelector value={language} onChange={setLanguage} options={LANGUAGES} />
              {currentQuestion && isAnswered(currentQuestion) && (
                <span className="text-xs px-2 py-0.5 rounded-md font-medium border bg-verified/10 text-verified border-verified/25">
                  Attempted
                </span>
              )}
            </div>

            <CodingEditor
              language={language}
              value={currentCode}
              onChange={handleCodeChange}
              height={520}
            />
          </div>
        </div>

        {/* Navigation (STEP 6) */}
        <div className="glass-strong rounded-2xl p-4 relative overflow-hidden">
          <div className="absolute top-0 inset-x-0 h-px bg-gradient-to-r from-transparent via-brand-400/30 to-transparent" />
          <QuestionNavigator
            total={questions.length}
            currentIndex={currentIndex}
            answeredFlags={answeredFlags}
            onSelect={setCurrentIndex}
            onPrev={() => setCurrentIndex((i) => Math.max(0, i - 1))}
            onNext={() => setCurrentIndex((i) => Math.min(questions.length - 1, i + 1))}
          />
        </div>
      </div>

      {/* Confirm / unanswered modal (STEP 8, 9) */}
      <ConfirmSubmitModal
        open={showConfirm}
        unanswered={unanswered}
        submitting={status === "submitting"}
        onCancel={() => setShowConfirm(false)}
        onConfirm={doSubmit}
      />

      {/* Success toast (STEP 12) */}
      {toast && (
        <div className="toast-notification toast-notification--success">
          <span className="toast-notification-text">OA submitted successfully.</span>
        </div>
      )}
    </div>
  );
}
