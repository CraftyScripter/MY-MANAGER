"use client";

import { useState, useRef, useEffect } from "react";

export interface DropdownOption {
  label: string;
  value: string;
  count?: number;
}

interface DropdownSelectProps {
  value: string;
  onChange: (value: string) => void;
  options: DropdownOption[];
  placeholder?: string;
  disabled?: boolean;
  className?: string;
  align?: "left" | "right";
  minWidth?: string;
}

export default function DropdownSelect({
  value,
  onChange,
  options,
  placeholder = "Select...",
  disabled = false,
  className = "",
  align = "right",
  minWidth = "210px",
}: DropdownSelectProps) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  useEffect(() => {
    function handleEscape(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    if (open) {
      document.addEventListener("keydown", handleEscape);
      return () => document.removeEventListener("keydown", handleEscape);
    }
  }, [open]);

  const selected = options.find((o) => o.value === value);
  const displayText = selected ? selected.label : placeholder;

  return (
    <div ref={ref} className={`relative ${className}`}>
      <button
        type="button"
        disabled={disabled}
        onClick={() => !disabled && setOpen(!open)}
        className={`w-full flex items-center justify-between gap-2.5 bg-white dark:bg-[#111114] border border-zinc-200 dark:border-zinc-800 rounded-xl px-3.5 py-2 text-xs font-semibold text-left transition-all duration-150 cursor-pointer shadow-xs active:scale-97 ${
          disabled
            ? "opacity-50 cursor-not-allowed"
            : "hover:bg-zinc-100 dark:hover:bg-zinc-800 hover:border-zinc-300 dark:hover:border-zinc-700"
        } ${open ? "ring-2 ring-zinc-400/20 dark:ring-zinc-700 border-zinc-300 dark:border-zinc-700" : ""} ${
          !selected ? "text-zinc-400 dark:text-zinc-500" : "text-zinc-700 dark:text-zinc-200"
        }`}
      >
        <span className="truncate">{displayText}</span>
        <svg
          className={`w-3.5 h-3.5 text-zinc-400 dark:text-zinc-400 shrink-0 transition-transform duration-200 ${
            open ? "rotate-180" : ""
          }`}
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={2}
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 8.25l-7.5 7.5-7.5-7.5" />
        </svg>
      </button>

      {open && (
        <div
          style={{ minWidth }}
          className={`absolute z-50 mt-1.5 w-full ${
            align === "right" ? "right-0" : "left-0"
          } bg-white dark:bg-[#111114] border border-zinc-200 dark:border-zinc-800 rounded-xl shadow-xl p-1.5 space-y-0.5 animate-in fade-in zoom-in-95 duration-100 overflow-hidden font-sans`}
        >
          <div className="max-h-60 overflow-y-auto overscroll-contain py-0.5 space-y-0.5">
            {options.map((option) => {
              const isSelected = option.value === value;
              return (
                <button
                  key={option.value}
                  type="button"
                  onClick={() => {
                    onChange(option.value);
                    setOpen(false);
                  }}
                  className={`w-full text-left px-3 py-2 text-xs font-semibold rounded-lg transition-colors duration-150 flex items-center justify-between gap-2 cursor-pointer ${
                    isSelected
                      ? "bg-zinc-100 dark:bg-zinc-800 text-zinc-900 dark:text-white"
                      : "text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800 hover:text-zinc-900 dark:hover:text-white"
                  }`}
                >
                  <span className="truncate">{option.label}</span>
                  {isSelected && (
                    <svg
                      className="w-3.5 h-3.5 text-zinc-900 dark:text-white shrink-0 ml-1.5"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                      strokeWidth={2.5}
                    >
                      <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                    </svg>
                  )}
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
