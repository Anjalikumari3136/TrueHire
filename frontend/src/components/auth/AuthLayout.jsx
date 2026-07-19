import { Link } from "react-router-dom";
import "./AuthLayout.css";

const PARTICLES = Array.from({ length: 14 }, (_, i) => ({
  id: i,
  left: `${Math.random() * 100}%`,
  animationDelay: `${Math.random() * 12}s`,
  animationDuration: `${10 + Math.random() * 14}s`,
  size: `${3 + Math.random() * 4}px`,
  opacity: 0.3 + Math.random() * 0.5,
}));

export default function AuthLayout({ left, children }) {
  return (
    <div className="auth-root">
      {/* Back to landing page — shown on every auth screen (top-left) */}
      <Link to="/" className="auth-back-home" aria-label="Back to Home">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M19 12H5" />
          <path d="M12 19l-7-7 7-7" />
        </svg>
        <span>Back to Home</span>
      </Link>

      {/* Blobs */}
      <div className="auth-blob auth-blob-1" />
      <div className="auth-blob auth-blob-2" />
      <div className="auth-blob auth-blob-3" />

      {/* Particles */}
      <div className="auth-particles">
        {PARTICLES.map((p) => (
          <div
            key={p.id}
            className="auth-particle"
            style={{
              left: p.left,
              width: p.size,
              height: p.size,
              opacity: p.opacity,
              animationDelay: p.animationDelay,
              animationDuration: p.animationDuration,
            }}
          />
        ))}
      </div>

      <div className="auth-split">
        {/* Left panel */}
        <div className="auth-left">
          <div className="auth-left-overlay" />
          {left}
        </div>

        {/* Right panel */}
        <div className="auth-right">
          <div className="auth-card">
            {children}
          </div>
        </div>
      </div>
    </div>
  );
}
