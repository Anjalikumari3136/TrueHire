import { useAccent } from "../context/AccentContext";

/**
 * Wraps the new Main Dashboard suite so the selected accent color applies only
 * here. Setting `data-accent` overrides the scoped --color-brand-* variables
 * (see styles/global.css) for everything inside — buttons, cards, progress,
 * links, highlights — without touching login / interview / report pages.
 */
export default function AccentScope({ children }) {
  const { accent, theme } = useAccent();
  return (
    <div className="accent-scope" data-accent={accent} data-theme={theme}>
      {children}
    </div>
  );
}
