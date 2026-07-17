import { GithubIcon, LinkedinIcon } from "./icons/BrandIcons";
import "./Footer.css";
import { BrainCircuit } from "lucide-react";
export default function Footer() {
  return (
    <footer className="footer">
      <div className="container footer__grid">
        <div>
          <div className="footer__brand">
  <BrainCircuit
    className="footer__logo-icon"
    size={24}
    color="#B794F4"
    strokeWidth={2.2}
  />
  <span>
    TrueHire <span className="gradient-text">AI</span>
  </span>
</div>
          <p>
            The most advanced AI Interview Intelligence platform. Build your
            Digital Twin, ace any interview.
          </p>
        </div>
        <div>
          <h4>Product</h4>
          <a href="#features">Features</a>
          <a href="#pricing">Pricing</a>
          <a href="#">Dashboard</a>
          <a href="#">Digital Twin</a>
          <a href="#">Career Roadmap</a>
        </div>
        <div>
          <h4>Company</h4>
          <a href="#">About</a>
          <a href="#">Blog</a>
          <a href="#">Careers</a>
          <a href="#">Press</a>
          <a href="#">Contact</a>
        </div>
        <div>
          <h4>Legal</h4>
          <a href="#">Privacy Policy</a>
          <a href="#">Terms of Service</a>
          <a href="#">Cookie Policy</a>
          <a href="#">Security</a>
        </div>
      </div>
      <div className="container footer__bottom">
        <span>© 2026 TrueHire AI, Inc. All rights reserved.</span>
        <div className="footer__social">
          <GithubIcon size={18} />
          <LinkedinIcon size={18} />
        </div>
      </div>
    </footer>
  );
}
