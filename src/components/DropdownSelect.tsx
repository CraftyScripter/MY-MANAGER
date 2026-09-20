"use client";

import React, { useState, useRef, useEffect, useCallback } from "react";
import { createPortal } from "react-dom";

export interface DropdownOption {
  label: string;
  value: string;
  count?: number;
  icon?: React.ReactNode;
  badge?: string;
  badgeClass?: string;
  description?: string;
}

interface DropdownSelectProps {
  value: string;
  onChange: (value: string) => void;
  options: DropdownOption[];
  placeholder?: string;
  disabled?: boolean;
  className?: string;
  buttonClassName?: string;
  menuClassName?: string;
  align?: "left" | "right";
  minWidth?: string;
  direction?: "up" | "down" | "auto";
  size?: "sm" | "md" | "lg";
  accentColor?: "blue" | "indigo" | "purple" | "emerald";
}

export default function DropdownSelect({
  value,
  onChange,
  options,
  placeholder = "Select...",
  disabled = false,
  className = "",
  buttonClassName = "",
  menuClassName = "",
  align = "right",
  minWidth = "210px",
  direction = "auto",
  size = "md",
  accentColor = "indigo",
}: DropdownSelectProps) {
  const [open, setOpen] = useState(false);
  const [menuStyle, setMenuStyle] = useState<React.CSSProperties>({});
  const triggerRef = useRef<HTMLDivElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  const calculatePosition = useCallback(() => {
    if (!triggerRef.current) return;
    const rect = triggerRef.current.getBoundingClientRect();
    const spaceBelow = window.innerHeight - rect.bottom;
    const spaceAbove = rect.top;

    let isUp = false;
    if (direction === "up") {
      isUp = true;
    } else if (direction === "down") {
      isUp = false;
    } else {
      isUp = spaceBelow < 260 && spaceAbove > 260;
    }

    const style: React.CSSProperties = {
      position: "fixed",
      zIndex: 99999,
      minWidth: minWidth || `${Math.max(rect.width, 140)}px`,
      width: rect.width > 220 ? `${rect.width}px` : undefined,
    };

    if (isUp) {
      style.bottom = `${window.innerHeight - rect.top + 6}px`;
      style.maxHeight = `${Math.min(300, Math.max(140, rect.top - 16))}px`;
    } else {
      style.top = `${rect.bottom + 6}px`;
      style.maxHeight = `${Math.min(300, Math.max(140, window.innerHeight - rect.bottom - 16))}px`;
    }

    if (align === "left") {
      style.left = `${Math.max(8, rect.left)}px`;
    } else {
      style.right = `${Math.max(8, window.innerWidth - rect.right)}px`;
    }

    setMenuStyle(style);
  }, [align, direction, minWidth]);

  const handleToggle = () => {
    if (disabled) return;
    if (!open) {
      calculatePosition();
      setOpen(true);
    } else {
      setOpen(false);
    }
  };

  useEffect(() => {
    if (!open) return;

    const handleUpdate = () => calculatePosition();
    const handleClickOutside = (e: MouseEvent) => {
      const target = e.target as Node;
      if (triggerRef.current && triggerRef.current.contains(target)) return;
      if (menuRef.current && menuRef.current.contains(target)) return;
      setOpen(false);
    };
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };

    window.addEventListener("scroll", handleUpdate, true);
    window.addEventListener("resize", handleUpdate);
    document.addEventListener("mousedown", handleClickOutside);
    document.addEventListener("keydown", handleKeyDown);

    return () => {
      window.removeEventListener("scroll", handleUpdate, true);
      window.removeEventListener("resize", handleUpdate);
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [open, calculatePosition]);

  const selected = options.find((o) => o.value === value);
  const displayText = selected ? selected.label : placeholder;

  const sizeButtonClasses =
    size === "sm"
      ? "h-7.5 px-2.5 text-xs rounded-lg"
      : size === "lg"
      ? "h-10 px-3.5 text-xs sm:text-sm rounded-xl"
      : "h-9 px-3.5 text-xs rounded-xl";

  const ringColorClass =
    accentColor === "indigo"
      ? "ring-2 ring-indigo-500/20 border-indigo-500/50 dark:border-indigo-500/40"
      : accentColor === "purple"
      ? "ring-2 ring-purple-500/20 border-purple-500/50 dark:border-purple-500/40"
      : accentColor === "emerald"
      ? "ring-2 ring-emerald-500/20 border-emerald-500/50 dark:border-emerald-500/40"
      : "ring-2 ring-blue-500/20 border-blue-500/50 dark:border-blue-500/40";

  const activeOptionClass =
    accentColor === "indigo"
      ? "bg-indigo-50 dark:bg-indigo-950/50 text-indigo-600 dark:text-indigo-400 border border-indigo-200/60 dark:border-indigo-800/60 font-bold"
      : accentColor === "purple"
      ? "bg-purple-50 dark:bg-purple-950/50 text-purple-600 dark:text-purple-400 border border-purple-200/60 dark:border-purple-800/60 font-bold"
      : accentColor === "emerald"
      ? "bg-emerald-50 dark:bg-emerald-950/50 text-emerald-600 dark:text-emerald-400 border border-emerald-200/60 dark:border-emerald-800/60 font-bold"
      : "bg-blue-50 dark:bg-blue-950/40 text-blue-600 dark:text-blue-400 border border-blue-100 dark:border-blue-900/40 font-bold";

  const arrowActiveColor =
    accentColor === "indigo"
      ? "text-indigo-500"
      : accentColor === "purple"
      ? "text-purple-500"
      : accentColor === "emerald"
      ? "text-emerald-500"
      : "text-blue-500";

  return (
    <div ref={triggerRef} className={`relative inline-block ${className}`}>
      <button
        type="button"
        disabled={disabled}
        onClick={handleToggle}
        className={`w-full flex items-center justify-between gap-2 bg-white dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800/90 text-left font-medium transition-all duration-150 cursor-pointer shadow-xs active:scale-[0.99] ${sizeButtonClasses} ${
          disabled
            ? "opacity-50 cursor-not-allowed"
            : "hover:bg-zinc-50 dark:hover:bg-zinc-900 hover:border-zinc-300 dark:hover:border-zinc-700"
        } ${open ? ringColorClass : ""} ${
          !selected ? "text-zinc-400 dark:text-zinc-500" : "text-zinc-900 dark:text-zinc-100"
        } ${buttonClassName}`}
      >
        <span className="flex items-center gap-2 truncate">
          {selected?.icon && <span className="shrink-0">{selected.icon}</span>}
          <span className="truncate">{displayText}</span>
          {selected?.badge && (
            <span
              className={`text-[10px] px-1.5 py-0.2 rounded font-semibold shrink-0 uppercase tracking-wider ${
                selected.badgeClass || "bg-zinc-800 text-zinc-300 border border-zinc-700"
              }`}
            >
              {selected.badge}
            </span>
          )}
        </span>
        <svg
          className={`w-3.5 h-3.5 text-zinc-400 dark:text-zinc-400 shrink-0 transition-transform duration-200 ${
            open ? `rotate-180 ${arrowActiveColor}` : ""
          }`}
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={2}
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 8.25l-7.5 7.5-7.5-7.5" />
        </svg>
      </button>

      {open && typeof document !== "undefined" && createPortal(
        <div
          ref={menuRef}
          style={menuStyle}
          className={`bg-white dark:bg-zinc-900/95 border border-zinc-200 dark:border-zinc-800 rounded-2xl shadow-2xl p-1.5 space-y-0.5 animate-in fade-in zoom-in-95 duration-100 overflow-hidden font-sans backdrop-blur-xl ${menuClassName}`}
        >
          <div className="overflow-y-auto overscroll-contain py-0.5 space-y-0.5 max-h-60 scrollbar-thin scrollbar-thumb-zinc-700">
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
                  className={`w-full text-left px-3 py-2 text-xs font-medium rounded-xl transition-all duration-150 flex items-center justify-between gap-2.5 cursor-pointer ${
                    isSelected
                      ? activeOptionClass
                      : "text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800/80 hover:text-zinc-900 dark:hover:text-white"
                  }`}
                >
                  <div className="flex items-center gap-2.5 truncate flex-1 min-w-0">
                    {option.icon && <span className="shrink-0 text-sm">{option.icon}</span>}
                    <div className="flex flex-col truncate">
                      <span className="truncate">{option.label}</span>
                      {option.description && (
                        <span className="text-[10px] text-zinc-500 font-normal truncate">
                          {option.description}
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center gap-1.5 shrink-0">
                    {option.badge && (
                      <span
                        className={`text-[10px] px-1.5 py-0.5 rounded font-semibold uppercase tracking-wider ${
                          option.badgeClass || "bg-zinc-800 text-zinc-300 border border-zinc-700"
                        }`}
                      >
                        {option.badge}
                      </span>
                    )}
                    {typeof option.count === "number" && (
                      <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-zinc-200 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 font-semibold">
                        {option.count}
                      </span>
                    )}
                    {isSelected && (
                      <svg
                        className="w-3.5 h-3.5 text-current shrink-0 ml-1"
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                        strokeWidth={2.5}
                      >
                        <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                      </svg>
                    )}
                  </div>
                </button>
              );
            })}
          </div>
        </div>,
        document.body
      )}
    </div>
  );
}

