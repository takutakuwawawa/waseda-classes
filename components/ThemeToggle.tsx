"use client";

import { useEffect, useSyncExternalStore } from "react";

type Theme = "dark" | "light";

const THEME_STORAGE_KEY = "minerva-theme";
const THEME_CHANGE_EVENT = "minerva-theme-change";

function readTheme(): Theme {
  if (typeof window === "undefined") return "dark";

  const saved = window.localStorage.getItem(THEME_STORAGE_KEY);
  return saved === "light" || saved === "dark" ? saved : "dark";
}

function subscribeToTheme(callback: () => void) {
  window.addEventListener("storage", callback);
  window.addEventListener(THEME_CHANGE_EVENT, callback);

  return () => {
    window.removeEventListener("storage", callback);
    window.removeEventListener(THEME_CHANGE_EVENT, callback);
  };
}

function saveTheme(theme: Theme) {
  document.documentElement.dataset.theme = theme;
  window.localStorage.setItem(THEME_STORAGE_KEY, theme);
  window.dispatchEvent(new Event(THEME_CHANGE_EVENT));
}

export function ThemeToggle() {
  const theme = useSyncExternalStore(subscribeToTheme, readTheme, () => "dark");

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
  }, [theme]);

  function toggleTheme() {
    saveTheme(theme === "dark" ? "light" : "dark");
  }

  return (
    <button
      type="button"
      onClick={toggleTheme}
      className="rounded-md border border-[var(--line)] bg-[var(--control)] px-3 py-1.5 text-xs font-medium text-[var(--text)] transition-colors hover:border-[var(--line-strong)]"
      aria-label="テーマを切り替える"
    >
      {theme === "dark" ? "Light" : "Dark"}
    </button>
  );
}
