"use client";

import React, { createContext, useContext, useEffect, useState, useCallback } from "react";

export type Theme = "light" | "dark" | "system";

interface ThemeContextType {
  theme: Theme;
  resolvedTheme: "light" | "dark";
  setTheme: (theme: Theme) => void;
  toggleTheme: () => void;
}

const ThemeContext = createContext<ThemeContextType>({
  theme: "dark",
  resolvedTheme: "dark",
  setTheme: () => {},
  toggleTheme: () => {},
});

function getSystemTheme(): "light" | "dark" {
  if (typeof window === "undefined") return "dark";
  return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

function resolveTheme(t: Theme): "light" | "dark" {
  if (t === "system") return getSystemTheme();
  return t;
}

function applyThemeToDOM(resolved: "light" | "dark") {
  if (typeof document === "undefined") return;
  const root = document.documentElement;
  if (resolved === "dark") {
    root.classList.add("dark");
    root.classList.remove("light");
    root.style.colorScheme = "dark";
  } else {
    root.classList.add("light");
    root.classList.remove("dark");
    root.style.colorScheme = "light";
  }
}

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setThemeState] = useState<Theme>("dark");
  const [resolvedTheme, setResolvedTheme] = useState<"light" | "dark">("dark");
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    try {
      const saved = (localStorage.getItem("pm_theme") as Theme) || "dark";
      const resolved = resolveTheme(saved);
      setThemeState(saved);
      setResolvedTheme(resolved);
      applyThemeToDOM(resolved);
    } catch {
      // Ignore localStorage errors
    }
    setMounted(true);
  }, []);

  const setTheme = useCallback((newTheme: Theme) => {
    const resolved = resolveTheme(newTheme);
    setThemeState(newTheme);
    setResolvedTheme(resolved);
    applyThemeToDOM(resolved);
    try {
      localStorage.setItem("pm_theme", newTheme);
    } catch {}
  }, []);

  const toggleTheme = useCallback(() => {
    setThemeState((currentTheme) => {
      const currentResolved = resolveTheme(currentTheme);
      const nextTheme: Theme = currentResolved === "dark" ? "light" : "dark";
      const nextResolved = resolveTheme(nextTheme);
      setResolvedTheme(nextResolved);
      applyThemeToDOM(nextResolved);
      try {
        localStorage.setItem("pm_theme", nextTheme);
      } catch {}
      return nextTheme;
    });
  }, []);

  // Listen to OS theme changes if theme is "system"
  useEffect(() => {
    if (!mounted || theme !== "system") return;

    const media = window.matchMedia("(prefers-color-scheme: dark)");
    const listener = (e: MediaQueryListEvent) => {
      const resolved = e.matches ? "dark" : "light";
      setResolvedTheme(resolved);
      applyThemeToDOM(resolved);
    };

    media.addEventListener("change", listener);
    return () => media.removeEventListener("change", listener);
  }, [theme, mounted]);

  return (
    <ThemeContext.Provider value={{ theme, resolvedTheme, setTheme, toggleTheme }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  return useContext(ThemeContext);
}
