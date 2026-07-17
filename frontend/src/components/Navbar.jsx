import "./Navbar.css";
import { BrainCircuit } from "lucide-react";
import { Link } from "react-router-dom";

export default function Navbar() {
  return (
    <header className="navbar">
      <div className="container navbar__inner">
        <Link to="/" className="navbar__logo">
          <div className="navbar__logo-box">
            <BrainCircuit
              size={20}
              color="#D8B4FE"
              strokeWidth={2.2}
              className="navbar__logo-icon"
            />
          </div>
          <span>
            TrueHire <span className="gradient-text">AI</span>
          </span>
        </Link>

        <nav className="navbar__links">
          <a href="#features">Features</a>
          <a href="#how-it-works">How It Works</a>
          <a href="#pricing">Pricing</a>
        </nav>

        <div className="navbar__actions">
          <Link to="/login" className="btn btn-ghost" id="nav-signin-btn">
            Sign In
          </Link>
          <Link to="/signup" className="btn btn-primary navbar__cta" id="nav-getstarted-btn">
            Get Started
          </Link>
        </div>

        <button type="button" className="navbar__menu" aria-label="Open menu">
          <span />
          <span />
          <span />
        </button>
      </div>
    </header>
  );
}
