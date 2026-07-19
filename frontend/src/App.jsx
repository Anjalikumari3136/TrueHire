import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import Navbar from "./components/Navbar";
import Hero from "./components/Hero";
import Features from "./components/Features";
import HowItWorks from "./components/HowItWorks";
import Pricing from "./components/Pricing";
import Footer from "./components/Footer";
import ChatFab from "./components/ChatFab";
import LoginPage from "./pages/LoginPage";
import SignupPage from "./pages/SignupPage";
import OtpPage from "./pages/OtpPage";
import ForgotPasswordPage from "./pages/ForgotPasswordPage";
import OnboardingFlow from "./app2/OnboardingFlow";
import OAPage from "./pages/OAPage";
import FinalReportPage from "./pages/FinalReportPage";
import MainDashboard from "./pages/MainDashboard";
import InterviewHistoryPage from "./pages/InterviewHistoryPage";
import ReportViewPage from "./pages/ReportViewPage";
import ProfilePage from "./pages/ProfilePage";
import ReportsPage from "./pages/ReportsPage";
import SettingsPage from "./pages/SettingsPage";
import ActivityPage from "./pages/ActivityPage";
import { AccentProvider } from "./context/AccentContext";
import AccentScope from "./components/AccentScope";
import "./styles/global.css";

function LandingPage() {
  return (
    <>
      <div className="page-bg" />
      <Navbar />
      <main>
        <Hero />
        <Features />
        <HowItWorks />
        <Pricing />
      </main>
      <Footer />
      <ChatFab />
    </>
  );
}
function isAuthenticated() {
  return Boolean(
    localStorage.getItem("truehire_token") ||
      sessionStorage.getItem("truehire_token")
  );
}

function ProtectedRoute({ children }) {
  return isAuthenticated() ? children : <Navigate to="/login" replace />;
}

// Guest-only routes (landing + auth pages). If already authenticated, bounce to
// the dashboard with `replace` so the browser Back button can't return to the
// Landing / Login / Register pages after signing in.
function GuestRoute({ children }) {
  return isAuthenticated() ? <Navigate to="/home" replace /> : children;
}

export default function App() {
  return (
    <AccentProvider>
      <BrowserRouter>
        <Routes>
        <Route path="/" element={<GuestRoute><LandingPage /></GuestRoute>} />
        <Route path="/login" element={<GuestRoute><LoginPage /></GuestRoute>} />
        <Route path="/signup" element={<GuestRoute><SignupPage /></GuestRoute>} />
        <Route path="/verify-otp" element={<GuestRoute><OtpPage /></GuestRoute>} />
        <Route path="/forgot-password" element={<GuestRoute><ForgotPasswordPage /></GuestRoute>} />

        {/* NEW: Main Dashboard — post-login landing page */}
        <Route
          path="/home"
          element={
            <ProtectedRoute>
              <AccentScope>
                <MainDashboard />
              </AccentScope>
            </ProtectedRoute>
          }
        />

        {/* NEW: Interview history */}
        <Route
          path="/history"
          element={
            <ProtectedRoute>
              <AccentScope>
                <InterviewHistoryPage />
              </AccentScope>
            </ProtectedRoute>
          }
        />

        {/* NEW: Reports, Profile, Settings, Activity */}
        <Route
          path="/reports"
          element={
            <ProtectedRoute>
              <AccentScope>
                <ReportsPage />
              </AccentScope>
            </ProtectedRoute>
          }
        />
        <Route
          path="/profile"
          element={
            <ProtectedRoute>
              <AccentScope>
                <ProfilePage />
              </AccentScope>
            </ProtectedRoute>
          }
        />
        <Route
          path="/settings"
          element={
            <ProtectedRoute>
              <AccentScope>
                <SettingsPage />
              </AccentScope>
            </ProtectedRoute>
          }
        />
        <Route
          path="/activity"
          element={
            <ProtectedRoute>
              <AccentScope>
                <ActivityPage />
              </AccentScope>
            </ProtectedRoute>
          }
        />

        {/* NEW: Report deep-link (existing FinalReportPage stays as-is) */}
        <Route
          path="/dashboard/report/:interviewId"
          element={
            <ProtectedRoute>
              <ReportViewPage />
            </ProtectedRoute>
          }
        />

        {/* Existing interview flow — UNCHANGED */}
        <Route
          path="/dashboard"
          element={
            <ProtectedRoute>
              <OnboardingFlow />
            </ProtectedRoute>
          }
        />

        <Route
          path="/interview/oa"
          element={
            <ProtectedRoute>
              <OAPage />
            </ProtectedRoute>
          }
        />

        <Route
          path="/interview/final-report"
          element={
            <ProtectedRoute>
              <FinalReportPage />
            </ProtectedRoute>
          }
        />

        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
    </AccentProvider>
  );
}


