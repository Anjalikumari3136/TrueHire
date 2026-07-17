import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { AuthProvider } from "./context/AuthContext";
import Navbar from "./components/Navbar";
import OnboardingWizard from "./components/OnboardingWizard";
import ProfileResults from "./components/ProfileResults";
import JobTarget from "./components/JobTarget";
import InterviewChat from "./components/InterviewChat";

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
        />
      )}
      {view === "interview" && interviewSession && (
        <InterviewChat sessionData={interviewSession} onBackToDashboard={handleReset} />
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
