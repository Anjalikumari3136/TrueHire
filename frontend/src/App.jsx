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

// The login flow stores the JWT under "truehire_token" in localStorage
// (Remember me) or sessionStorage. Gate the post-login flow on it.
function isAuthenticated() {
  return Boolean(
    localStorage.getItem("truehire_token") ||
      sessionStorage.getItem("truehire_token")
  );
}

function ProtectedRoute({ children }) {
  return isAuthenticated() ? children : <Navigate to="/login" replace />;
}

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        {/* Public */}
        <Route path="/" element={<LandingPage />} />
        <Route path="/login" element={<LoginPage />} />
        <Route path="/signup" element={<SignupPage />} />
        <Route path="/verify-otp" element={<OtpPage />} />
        <Route path="/forgot-password" element={<ForgotPasswordPage />} />

        {/* Post-login flow (frontend2 UI) — opens after login */}
        <Route
          path="/dashboard"
          element={
            <ProtectedRoute>
              <OnboardingFlow />
            </ProtectedRoute>
          }
        />

        {/* Fallback */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}


