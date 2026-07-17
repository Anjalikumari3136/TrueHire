import {
  Upload,
  Video,
  Cpu,
  Target,
  TrendingUp,
} from "lucide-react";
import { GithubIcon, LinkedinIcon } from "./icons/BrandIcons";
import "./HowItWorks.css";

const steps = [
  {
    n: "01",
    title: "Upload Resume",
    desc: "AI parses every skill, project, and achievement automatically.",
    icon: Upload,
    color: "#6366f1",
  },
  {
    n: "02",
    title: "Connect GitHub",
    desc: "Deep analysis of repos, commits, and code quality.",
    icon: GithubIcon,
    color: "#a855f7",
  },
  {
    n: "03",
    title: "Import LinkedIn",
    desc: "Skills, endorsements, and experience imported instantly.",
    icon: LinkedinIcon,
    color: "#14b8a6",
  },
  {
    n: "04",
    title: "Take AI Interview",
    desc: "Multimodal mock interviews with real-time feedback.",
    icon: Video,
    color: "#22c55e",
  },
  {
    n: "05",
    title: "Twin Is Built",
    desc: "Your AI Digital Twin is synthesized from all data sources.",
    icon: Cpu,
    color: "#f97316",
  },
  {
    n: "06",
    title: "Learn & Practice",
    desc: "Targeted drills based on your weakest areas.",
    icon: Target,
    color: "#ef4444",
  },
  {
    n: "07",
    title: "Continuous Growth",
    desc: "Your twin evolves with every session and new data.",
    icon: TrendingUp,
    color: "#8b5cf6",
  },
];

export default function HowItWorks() {
  return (
    <section id="how-it-works" className="how">
      <div className="container">
        <h2 className="section-title">
          How <span className="gradient-text">TrueHire AI</span> works
        </h2>
        <p className="section-subtitle">
          Seven steps from raw profile to interview-ready twin
        </p>

        <div className="how__steps">
          {steps.map(({ n, title, desc, icon: Icon, color }) => (
            <div key={n} className="how__step">
              <div
                className="how__icon-wrap"
                style={{ boxShadow: `0 0 24px ${color}33` }}
              >
                <div
                  className="how__icon"
                  style={{ background: `${color}22`, color }}
                >
                  <Icon size={20} />
                </div>
                <span className="how__num">{n}</span>
              </div>
              <h4>{title}</h4>
              <p>{desc}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
