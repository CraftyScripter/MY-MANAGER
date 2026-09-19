"use client";

import React from "react";
import { useTheme, Theme } from "./ThemeProvider";

interface ThemeToggleProps {
  variant?: "segmented" | "toggle" | "button" | "card";
  className?: string;
  showLabel?: boolean;
}

export default React.memo(function ThemeToggle({
  variant = "segmented",
  className = "",
  showLabel = true,
}: ThemeToggleProps) {
  const { theme, resolvedTheme, setTheme, toggleTheme } = useTheme();

  // 1. Subtle, Muted Segmented Toggle (Light / System / Dark)
  if (variant === "segmented" || variant === "toggle") {
    const options: { id: Theme; label: string; icon: React.ReactNode }[] = [
      {
        id: "light",
        label: "Light",
        icon: (
          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 3v2.25m6.364.386l-1.591 1.591M21 12h-2.25m-.386 6.364l-1.591-1.591M12 18.75V21m-4.773-4.227l-1.591 1.591M5.25 12H3m4.227-4.773L5.636 5.636M15.75 12a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0z" />
          </svg>
        ),
      },
      {
        id: "system",
        label: "System",
        icon: (
          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 17.25v1.007a3 3 0 01-.879 2.122L7.5 21h9l-.621-.621A3 3 0 0115 18.257V17.25m6-12V15a2.25 2.25 0 01-2.25 2.25H5.25A2.25 2.25 0 013 15V5.25m18 0A2.25 2.25 0 0018.75 3H5.25A2.25 2.25 0 003 5.25m18 0H3" />
          </svg>
        ),
      },
      {
        id: "dark",
        label: "Dark",
        icon: (
          <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 24 24">
            <path d="M21.752 15.002A9.718 9.718 0 0118 15.75c-5.385 0-9.75-4.365-9.75-9.75 0-1.33.266-2.597.748-3.752A9.753 9.753 0 003 11.25C3 16.635 7.365 21 12.75 21a9.753 9.753 0 009.002-5.998z" />
          </svg>
        ),
      },
    ];

    return (
      <div className={`grid grid-cols-3 w-full p-1 bg-zinc-100 dark:bg-zinc-900/90 border border-zinc-200 dark:border-zinc-800 rounded-xl ${className}`}>
        {options.map((opt) => {
          const isSelected = theme === opt.id;
          return (
            <button
              key={opt.id}
              type="button"
              onClick={() => setTheme(opt.id)}
              className={`w-full min-w-0 flex items-center justify-center gap-1.5 py-1.5 px-1 rounded-lg text-xs transition-all duration-150 cursor-pointer select-none ${
                isSelected
                  ? "bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 font-semibold shadow-xs border border-zinc-200/80 dark:border-zinc-700/60"
                  : "text-zinc-500 dark:text-zinc-400 hover:text-zinc-800 dark:hover:text-zinc-200 hover:bg-zinc-200/50 dark:hover:bg-zinc-800/40 border border-transparent font-medium"
              }`}
            >
              <span className="shrink-0">{opt.icon}</span>
              <span className="truncate text-[11px] sm:text-xs leading-none">{opt.label}</span>
            </button>
          );
        })}
      </div>
    );
  }

  // 2. Settings Card Grid Variant
  if (variant === "card") {
    const options: { id: Theme; title: string; desc: string; icon: React.ReactNode }[] = [
      {
        id: "dark",
        title: "Dark Mode",
        desc: "Sleek metallic dark theme with enhanced contrast",
        icon: (
          <svg className="w-5 h-5 text-rose-400" fill="currentColor" viewBox="0 0 24 24">
            <path d="M21.752 15.002A9.718 9.718 0 0118 15.75c-5.385 0-9.75-4.365-9.75-9.75 0-1.33.266-2.597.748-3.752A9.753 9.753 0 003 11.25C3 16.635 7.365 21 12.75 21a9.753 9.753 0 009.002-5.998z" />
          </svg>
        ),
      },
      {
        id: "light",
        title: "Light Mode",
        desc: "Clean bright theme with clear crisp typography",
        icon: (
          <svg className="w-5 h-5 text-amber-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 3v2.25m6.364.386l-1.591 1.591M21 12h-2.25m-.386 6.364l-1.591-1.591M12 18.75V21m-4.773-4.227l-1.591 1.591M5.25 12H3m4.227-4.773L5.636 5.636M15.75 12a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0z" />
          </svg>
        ),
      },
      {
        id: "system",
        title: "System Default",
        desc: "Automatically match your OS theme preference",
        icon: (
          <svg className="w-5 h-5 text-blue-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 17.25v1.007a3 3 0 01-.879 2.122L7.5 21h9l-.621-.621A3 3 0 0115 18.257V17.25m6-12V15a2.25 2.25 0 01-2.25 2.25H5.25A2.25 2.25 0 013 15V5.25m18 0A2.25 2.25 0 0018.75 3H5.25A2.25 2.25 0 003 5.25m18 0H3" />
          </svg>
        ),
      },
    ];

    return (
      <div className={`grid grid-cols-1 sm:grid-cols-3 gap-3 ${className}`}>
        {options.map((opt) => {
          const isSelected = theme === opt.id;
          return (
            <button
              key={opt.id}
              type="button"
              onClick={() => setTheme(opt.id)}
              className={`text-left p-4 rounded-2xl border transition-all duration-150 cursor-pointer flex flex-col justify-between gap-3 active:scale-[0.98] ${
                isSelected
                  ? "bg-rose-500/10 dark:bg-rose-500/15 border-rose-500 ring-2 ring-rose-500/20 text-zinc-900 dark:text-white shadow-xs"
                  : "bg-white dark:bg-[#151518] border-zinc-200 dark:border-zinc-800 hover:border-zinc-300 dark:hover:border-zinc-700 text-zinc-600 dark:text-zinc-400"
              }`}
            >
              <div className="flex items-center justify-between w-full">
                <div className="w-9 h-9 rounded-xl bg-zinc-100 dark:bg-[#202026] flex items-center justify-center border border-zinc-200/80 dark:border-zinc-700/60 shadow-2xs">
                  {opt.icon}
                </div>
                <span
                  className={`w-4 h-4 rounded-full border flex items-center justify-center transition-colors ${
                    isSelected ? "border-rose-500 bg-rose-500" : "border-zinc-300 dark:border-zinc-600"
                  }`}
                >
                  {isSelected && <span className="w-1.5 h-1.5 rounded-full bg-white" />}
                </span>
              </div>
              <div>
                <h4 className={`text-sm font-bold ${isSelected ? "text-rose-600 dark:text-rose-400" : "text-zinc-800 dark:text-zinc-200"}`}>
                  {opt.title}
                </h4>
                <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-1 leading-relaxed">
                  {opt.desc}
                </p>
              </div>
            </button>
          );
        })}
      </div>
    );
  }

  // 4. Default Compact Button
  return (
    <button
      type="button"
      onClick={toggleTheme}
      className={`flex items-center gap-2 px-2.5 py-1.5 rounded-xl text-xs font-semibold text-zinc-700 dark:text-zinc-300 hover:text-zinc-900 dark:hover:text-white bg-zinc-100 hover:bg-zinc-200/80 dark:bg-[#151518] dark:hover:bg-[#1f1f24] border border-zinc-200/80 dark:border-zinc-800/80 transition-all cursor-pointer shadow-2xs active:scale-95 ${className}`}
      title={`Current: ${resolvedTheme} mode (Click to toggle)`}
    >
      <span className="text-sm">{resolvedTheme === "light" ? "☀️" : "🌙"}</span>
      <span className="capitalize">{resolvedTheme} Mode</span>
    </button>
  );
});

