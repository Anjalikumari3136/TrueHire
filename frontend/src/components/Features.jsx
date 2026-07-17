import {
  FileText,
  Brain,
  GitBranch,
  Video,
  BarChart3,
  Layers,
} from "lucide-react";
import { LinkedinIcon } from "./icons/BrandIcons";
import "./Features.css";

const tags = [
  "Resume",
  "GitHub",
  "LinkedIn",
  "Interviews",
  "Coding",
  "Portfolio",
];

export default function Features() {
  return (
    <section id="features" className="features">
      <div className="container">
        <h2 className="section-title">
          Everything to <span className="gradient-text">ace any interview</span>
        </h2>
        <p className="section-subtitle">
          A complete intelligence stack that transforms how you prepare,
          practice, and perform.
        </p>

        <div className="features__bento">
          <article className="card features__resume">
            <div
              className="icon-badge"
              style={{ background: "rgba(99,102,241,0.15)" }}
            >
              <FileText color="#6366f1" size={20} />
            </div>
            <h3>Resume Intelligence</h3>
            <p>
              ATS scoring, keyword extraction, and gap analysis vs. target job
              descriptions.
            </p>
            <a className="learn-more" href="#">
              Learn more →
            </a>
          </article>

          <article className="card features__twin">
            <div
              className="icon-badge"
              style={{ background: "rgba(20,184,166,0.15)" }}
            >
              <Brain color="#14b8a6" size={20} />
            </div>
            <h3>AI Digital Twin</h3>
            <p>
              Your continuously evolving AI profile that learns from every
              interaction and interview session in real time.
            </p>
            <div className="features__tags">
              {tags.map((t) => (
                <span key={t}>{t}</span>
              ))}
            </div>
            <a className="learn-more" href="#">
              Learn more →
            </a>
          </article>

          <article className="card features__github">
            <div
              className="icon-badge"
              style={{ background: "rgba(168,85,247,0.15)" }}
            >
              <GitBranch color="#a855f7" size={20} />
            </div>
            <h3>GitHub Analysis</h3>
            <p>
              Code quality, contribution patterns, and project complexity metrics.
            </p>
          </article>

          <article className="card features__linkedin">
            <div
              className="icon-badge"
              style={{ background: "rgba(20,184,166,0.15)" }}
            >
              <LinkedinIcon color="#14b8a6" size={20} />
            </div>
            <h3>LinkedIn Extraction</h3>
            <p>
              Skills, endorsements, and experience signals automatically
              imported.
            </p>
          </article>

          <article className="card features__mock">
            <div
              className="icon-badge"
              style={{ background: "rgba(249,115,22,0.15)" }}
            >
              <Video color="#f97316" size={20} />
            </div>
            <h3>AI Mock Interviews</h3>
            <p>
              FAANG-style simulation with real-time transcription and multimodal
              feedback.
            </p>
          </article>
        </div>

        <div className="features__row">
          <article className="card">
            <div
              className="icon-badge"
              style={{ background: "rgba(20,184,166,0.15)" }}
            >
              <BarChart3 color="#14b8a6" size={20} />
            </div>
            <h3>Interview Analytics</h3>
            <p>
              Deep score trends, topic heatmaps, and company-specific readiness
              scores.
            </p>
            <a className="learn-more" href="#">
              Learn more →
            </a>
          </article>
          <article className="card">
            <div
              className="icon-badge"
              style={{ background: "rgba(34,197,94,0.15)" }}
            >
              <Layers color="#22c55e" size={20} />
            </div>
            <h3>Portfolio Evaluation</h3>
            <p>
              Project quality, tech-stack relevance, and presentation
              effectiveness scored by AI.
            </p>
            <a className="learn-more" href="#">
              Learn more →
            </a>
          </article>
        </div>
      </div>
    </section>
  );
}
