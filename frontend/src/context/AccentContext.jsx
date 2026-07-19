import { createContext, useCallback, useContext, useEffect, useState } from "react";
import { getMe, updatePreferences } from "../services/dashboardApi";

/**
 * Dashboard accent color context.
 *
 * Single source of truth for the Main Dashboard's accent color. The value is:
 *   - applied instantly (no reload) by AccentScope, which sets `data-accent`
 *     and thereby overrides the scoped --color-brand-* CSS variables;
 *   - persisted per-user in the database (PUT /api/auth/preferences) with a
 *     localStorage fallback for instant first paint / offline;
 *   - restored on next login by fetching the user's stored preference.
 */

export const ACCENTS = [
  { id: "purple", label: "Purple", swatch: "#6366f1" },
  { id: "blue", label: "Blue", swatch: "#3b82f6" },
  { id: "green", label: "Green", swatch: "#10b981" },
];

export const THEMES = ["light", "dark"];

const VALID = new Set(ACCENTS.map((a) => a.id));
const VALID_THEME = new Set(THEMES);
const STORAGE_KEY = "truehire_accent";
const THEME_KEY = "truehire_theme";

const AccentContext = createContext({
  accent: "purple",
  setAccent: () => {},
  theme: "dark",
  setTheme: () => {},
  ACCENTS,
  THEMES,
});

function hasToken() {
  return Boolean(localStorage.getItem("truehire_token") || sessionStorage.getItem("truehire_token"));
}

export function AccentProvider({ children }) {
  const [accent, setAccentState] = useState(() => {
    const saved = localStorage.getItem(STORAGE_KEY);
    return saved && VALID.has(saved) ? saved : "purple";
  });
  const [theme, setThemeState] = useState(() => {
    const saved = localStorage.getItem(THEME_KEY);
    return saved && VALID_THEME.has(saved) ? saved : "dark";
  });

  // Restore the user's stored preferences from the DB after login.
  useEffect(() => {
    if (!hasToken()) return;
    let cancelled = false;
    getMe()
      .then((user) => {
        if (cancelled) return;
        if (user?.accentColor && VALID.has(user.accentColor)) {
          setAccentState(user.accentColor);
          localStorage.setItem(STORAGE_KEY, user.accentColor);
        }
        if (user?.theme && VALID_THEME.has(user.theme)) {
          setThemeState(user.theme);
          localStorage.setItem(THEME_KEY, user.theme);
        }
      })
      .catch(() => {
        /* keep the localStorage/default value */
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const setAccent = useCallback((next) => {
    if (!VALID.has(next)) return;
    setAccentState(next); // instant, no reload
    localStorage.setItem(STORAGE_KEY, next);
    if (hasToken()) {
      updatePreferences({ accentColor: next }).catch(() => {
        /* localStorage still holds the choice; will sync next time */
      });
    }
  }, []);

  const setTheme = useCallback((next) => {
    if (!VALID_THEME.has(next)) return;
    setThemeState(next); // instant, no reload
    localStorage.setItem(THEME_KEY, next);
    if (hasToken()) {
      updatePreferences({ theme: next }).catch(() => {
        /* localStorage still holds the choice; will sync next time */
      });
    }
  }, []);

  return (
    <AccentContext.Provider value={{ accent, setAccent, theme, setTheme, ACCENTS, THEMES }}>
      {children}
    </AccentContext.Provider>
  );
}

export function useAccent() {
  return useContext(AccentContext);
}
