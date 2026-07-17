import {
  ArrowRight,
  Play,
  Sparkles,
  FileText,
  Globe,
  Code2,
  Video,
} from "lucide-react";
import { GithubIcon, LinkedinIcon } from "./icons/BrandIcons";
import "./Hero.css";
import { BrainCircuit } from "lucide-react";
const orbitItems = [
  { label: "Resume", icon: FileText, angle: -90, color: "#6366f1" },
  { label: "GitHub", icon: GithubIcon, angle: -30, color: "#a855f7" },
  { label: "LinkedIn", icon: LinkedinIcon, angle: 30, color: "#0ea5e9" },
  { label: "Portfolio", icon: Globe, angle: 90, color: "#14b8a6" },
  { label: "Coding", icon: Code2, angle: 150, color: "#22c55e" },
  { label: "Interviews", icon: Video, angle: 210, color: "#ef4444" },
];

export default function Hero() {
  return (
    <section className="hero">
      <div className="container hero__grid">
        <div className="hero__content">
          <div className="hero__badge">
            <Sparkles size={14} />
            AI-Powered Interview Intelligence · 2026
          </div>

          <h1 className="hero__title">
            Meet Your AI
            <br />
            <span className="gradient-text">Digital Interview</span>
            <br />
            Twin
          </h1>

          <p className="hero__desc">
            TrueHire AI learns from your Resume, GitHub, LinkedIn, coding
            sessions, and mock interviews to build a living AI twin that
            represents you authentically in every interview scenario.
          </p>

          <div className="hero__actions">
            <button type="button" className="btn btn-primary hero__btn-primary">
              Build My Digital Twin <ArrowRight size={18} />
            </button>
            <button type="button" className="btn btn-secondary hero__btn-secondary">
              <Play size={16} fill="currentColor" /> Watch Demo
            </button>
          </div>
        </div>

        <div className="hero__visual">
          <div className="orbit">
            <div className="orbit__ring" />
            {orbitItems.map(({ label, icon: Icon, angle, color }) => (
              <div
                key={label}
                className="orbit__node"
                style={{
                  transform: `rotate(${angle}deg) translate(145px) rotate(${-angle}deg)`,
                }}
              >
                <div
                  className="orbit__node-box"
                  style={{ borderColor: `${color}33` }}
                >
                  <Icon size={18} color={color} />
                </div>
                <span>{label}</span>
              </div>
            ))}
            <div className="orbit__center">
              <div className="orbit__center-icon">
                <BrainCircuit
                  size={34}
                  color="#B794F4"
                  strokeWidth={2.2}
                />
              </div>
              <span>AI TWIN</span>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
