/**
 * Theme management system for dark/light mode
 */

export type Theme = "dark" | "light";

export interface ThemeColors {
  bg: string;
  bgSecondary: string;
  text: string;
  textSecondary: string;
  border: string;
  borderLight: string;
  accent: string;
  success: string;
  warning: string;
  error: string;
}

const THEME_KEY = "wordleWarTheme";

const themes: Record<Theme, ThemeColors> = {
  dark: {
    bg: "#050505",
    bgSecondary: "#1a1a1a",
    text: "#ffffff",
    textSecondary: "#a0a0a0",
    border: "rgba(255,255,255,0.1)",
    borderLight: "rgba(255,255,255,0.05)",
    accent: "#ef4444",
    success: "#22c55e",
    warning: "#eab308",
    error: "#ef4444",
  },
  light: {
    bg: "#ffffff",
    bgSecondary: "#f5f5f5",
    text: "#1a1a1a",
    textSecondary: "#666666",
    border: "rgba(0,0,0,0.1)",
    borderLight: "rgba(0,0,0,0.05)",
    accent: "#dc2626",
    success: "#16a34a",
    warning: "#ca8a04",
    error: "#dc2626",
  },
};

export function getTheme(): Theme {
  try {
    const stored = localStorage.getItem(THEME_KEY);
    if (stored === "light" || stored === "dark") return stored;
  } catch {
    // Fallback
  }
  return "dark";
}

export function setTheme(theme: Theme) {
  try {
    localStorage.setItem(THEME_KEY, theme);
    applyTheme(theme);
  } catch {
    // Fallback
  }
}

export function toggleTheme() {
  const current = getTheme();
  const next = current === "dark" ? "light" : "dark";
  setTheme(next);
  return next;
}

export function getThemeColors(theme?: Theme): ThemeColors {
  return themes[theme || getTheme()];
}

export function applyTheme(theme: Theme) {
  const colors = themes[theme];
  const root = document.documentElement;
  
  root.style.setProperty("--color-bg", colors.bg);
  root.style.setProperty("--color-bg-secondary", colors.bgSecondary);
  root.style.setProperty("--color-text", colors.text);
  root.style.setProperty("--color-text-secondary", colors.textSecondary);
  root.style.setProperty("--color-border", colors.border);
  root.style.setProperty("--color-border-light", colors.borderLight);
  root.style.setProperty("--color-accent", colors.accent);
  root.style.setProperty("--color-success", colors.success);
  root.style.setProperty("--color-warning", colors.warning);
  root.style.setProperty("--color-error", colors.error);
}

// Initialize theme on app load
if (typeof window !== "undefined") {
  applyTheme(getTheme());
}
