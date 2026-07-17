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
