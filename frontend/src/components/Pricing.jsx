import { Check, Star } from "lucide-react";
import "./Pricing.css";

const plans = [
  {
    name: "Free",
    price: "$0",
    period: "/forever",
    desc: "Start building your interview foundation",
    features: [
      "5 AI Mock Interviews/month",
      "Resume Analysis",
      "Basic AI Feedback",
      "Score Tracking",
      "2 Coding Sessions",
    ],
    cta: "Get Started Free",
    featured: false,
  },
  {
    name: "Pro",
    price: "$29",
    period: "/per month",
    desc: "For serious candidates targeting top companies",
    features: [
      "Unlimited AI Interviews",
      "Full Digital Twin",
      "GitHub + LinkedIn Sync",
      "Weakness Detection",
      "Career Roadmap",
      "Company-Specific Prep",
      "Priority Support",
    ],
    cta: "Start Pro Trial",
    featured: true,
  },
  {
    name: "Enterprise",
    price: "Custom",
    period: "/contact us",
    desc: "For teams, bootcamps, and recruiting firms",
    features: [
      "Everything in Pro",
      "Recruiter Dashboard",
      "Team Analytics",
      "Bulk Import",
      "API Access",
      "White-label",
      "Dedicated Account Manager",
    ],
    cta: "Contact Sales",
    featured: false,
  },
];

export default function Pricing() {
  return (
    <section id="pricing" className="pricing">
      <div className="container">
        <h2 className="section-title">
          Simple, transparent <span className="gradient-text">pricing</span>
        </h2>
        <p className="section-subtitle">No surprises. Cancel anytime.</p>

        <div className="pricing__grid">
          {plans.map((plan) => (
            <article
              key={plan.name}
              className={`card pricing__card ${plan.featured ? "pricing__card--featured" : ""}`}
            >
              {plan.featured && (
                <div className="pricing__badge">
                  <Star size={12} fill="currentColor" /> Most Popular
                </div>
              )}
              <h3>{plan.name}</h3>
              <div className="pricing__price">
                <span>{plan.price}</span>
                <small>{plan.period}</small>
              </div>
              <p className="pricing__desc">{plan.desc}</p>
              <ul>
                {plan.features.map((f) => (
                  <li key={f}>
                    <Check size={16} /> {f}
                  </li>
                ))}
              </ul>
              <button
                type="button"
                className={`btn ${plan.featured ? "btn-primary" : "btn-secondary"} pricing__btn`}
              >
                {plan.cta}
              </button>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}
