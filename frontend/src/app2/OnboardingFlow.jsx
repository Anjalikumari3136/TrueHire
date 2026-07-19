import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { AuthProvider } from "./context/AuthContext";
import Navbar from "./components/Navbar";
import OnboardingWizard from "./components/OnboardingWizard";
import ProfileResults from "./components/ProfileResults";
import JobTarget from "./components/JobTarget";
import InterviewChat from "./components/InterviewChat";
import { resumeInterview } from "./api";

/**
 * Post-login flow integrated from frontend2.
 * Landing/auth stay in the main frontend (react-router); this is a
 * self-contained state machine mounted at /dashboard after login:
 *   upload -> results -> job_target -> interview
 */
function FlowContent() {
  const navigate = useNavigate();
  const [view, setView] = useState("upload");
  const [profileData, setProfileData] = useState(null);
  const [interviewSession, setInterviewSession] = useState(null);
  const [jobTargetInit, setJobTargetInit] = useState(null); // { step, form } when returning from OA

  // "Resume Interview" from the dashboard: reuse the previous résumé's analysis
  // (no re-upload) and jump straight to the round-selection screen so the
  // candidate continues from the next unlocked round.
  useEffect(() => {
    if (sessionStorage.getItem("truehire_resume") !== "1") return;
    sessionStorage.removeItem("truehire_resume");
    const token =
      localStorage.getItem("truehire_token") || sessionStorage.getItem("truehire_token");
    if (!token) return;

    (async () => {
      try {
        const data = await resumeInterview(token);
        setProfileData(data.profile);
        // Restore the job context captured when the interview started (same browser).
        let form = {};
        try {
          const ctx = JSON.parse(sessionStorage.getItem("truehire_flow_ctx") || "null");
          if (ctx) {
            form = {
              company: ctx.company,
              jobDescription: ctx.jobDescription,
              experience: ctx.experience,
              roundType: ctx.roundType,
            };
          }
        } catch {
          /* ignore malformed context */
        }
        setJobTargetInit({ step: "round_select", form });
        setView("job_target");
      } catch {
        /* nothing resumable — stay on the upload screen (fresh start) */
      }
    })();
  }, []);

  // After the OA round finishes, return the candidate straight to the
  // "Select Interview Round" screen instead of restarting from upload.
  useEffect(() => {
    if (sessionStorage.getItem("truehire_return_round_select") !== "1") return;
    sessionStorage.removeItem("truehire_return_round_select");
    try {
      const ctx = JSON.parse(sessionStorage.getItem("truehire_flow_ctx") || "null");
      if (ctx?.profileData) {
        setProfileData(ctx.profileData);
        setJobTargetInit({
          step: "round_select",
          form: {
            company: ctx.company,
            jobDescription: ctx.jobDescription,
            experience: ctx.experience,
            roundType: ctx.roundType,
          },
        });
        setView("job_target");
      }
    } catch {
      /* ignore malformed context */
    }
  }, []);

  const handleNavigate = (target) => {
    // Navbar logout sends the user to the public landing route.
    if (target === "landing") {
      navigate("/");
      return;
    }
    setView(target);
  };

  const handleResult = (data) => {
    setProfileData(data);
    setView("results");
  };

  const handleReset = () => {
    setProfileData(null);
    setInterviewSession(null);
    setView("upload");
  };

  const handleJobTargetSubmit = (payload) => {
    setInterviewSession(payload);
    setView("interview");
  };

  // After a Technical/HR round finishes (but the interview isn't complete),
  // return to the "Select Interview Round" screen — with the round progress
  // preserved — so the candidate can take the next now-unlocked round instead
  // of restarting from résumé upload.
  const handleBackToRounds = () => {
    setJobTargetInit({
      step: "round_select",
      form: {
        company: interviewSession?.company,
        jobDescription: interviewSession?.jobDescription,
        experience: interviewSession?.experience,
        roundType: interviewSession?.roundType,
      },
    });
    setView("job_target");
  };

  return (
    <>
      {/* Ambient background glow */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden -z-10">
        <div className="absolute top-[-20%] left-[-10%] w-[600px] h-[600px] rounded-full bg-brand-700/[0.07] blur-[120px]" />
        <div className="absolute bottom-[-20%] right-[-10%] w-[500px] h-[500px] rounded-full bg-brand-500/[0.05] blur-[100px]" />
      </div>

      <Navbar onNavigate={handleNavigate} />

      {view === "upload" && <OnboardingWizard onResult={handleResult} />}
      {view === "results" && profileData && (
        <ProfileResults
          data={profileData}
          onReset={handleReset}
          onContinue={() => setView("job_target")}
        />
      )}
      {view === "job_target" && profileData && (
        <JobTarget
          profileData={profileData}
          onBack={() => setView("results")}
          onSubmit={handleJobTargetSubmit}
          initialStep={jobTargetInit?.step}
          initialForm={jobTargetInit?.form}
        />
      )}
      {view === "interview" && interviewSession && (
        <InterviewChat
          sessionData={interviewSession}
          onBackToDashboard={handleReset}
          onBackToRounds={handleBackToRounds}
        />
      )}
    </>
  );
}

export default function OnboardingFlow() {
  return (
    <AuthProvider>
      <FlowContent />
    </AuthProvider>
  );
}
