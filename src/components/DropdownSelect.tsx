"use client";

import React, { useState, useRef, useEffect, useCallback } from "react";
import { createPortal } from "react-dom";

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
  buttonClassName?: string;
  align?: "left" | "right";
  minWidth?: string;
  direction?: "up" | "down" | "auto";
  size?: "sm" | "md";
}

export default function DropdownSelect({
  value,
  onChange,
  options,
  placeholder = "Select...",
  disabled = false,
  className = "",
  buttonClassName = "",
  align = "right",
  minWidth = "210px",
  direction = "auto",
  size = "md",
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
      isUp = spaceBelow < 220 && spaceAbove > 220;
    }

    const style: React.CSSProperties = {
      position: "fixed",
      zIndex: 99999,
      minWidth: minWidth || `${Math.max(rect.width, 80)}px`,
    };

    if (isUp) {
      style.bottom = `${window.innerHeight - rect.top + 6}px`;
      style.maxHeight = `${Math.min(260, Math.max(120, rect.top - 16))}px`;
    } else {
      style.top = `${rect.bottom + 6}px`;
      style.maxHeight = `${Math.min(260, Math.max(120, window.innerHeight - rect.bottom - 16))}px`;
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
      : "h-9 px-3.5 text-xs rounded-xl";

  return (
    <div ref={triggerRef} className={`relative inline-block ${className}`}>
      <button
        type="button"
        disabled={disabled}
        onClick={handleToggle}
        className={`w-full flex items-center justify-between gap-2 bg-white dark:bg-[#111114] border border-zinc-200 dark:border-zinc-800 text-left font-semibold transition-all duration-150 cursor-pointer shadow-xs active:scale-97 ${sizeButtonClasses} ${
          disabled
            ? "opacity-50 cursor-not-allowed"
            : "hover:bg-zinc-50 dark:hover:bg-zinc-800/60 hover:border-zinc-300 dark:hover:border-zinc-700"
        } ${open ? "ring-2 ring-blue-500/20 border-blue-500/50 dark:border-blue-500/40" : ""} ${
          !selected ? "text-zinc-400 dark:text-zinc-500" : "text-zinc-900 dark:text-zinc-100"
        } ${buttonClassName}`}
      >
        <span className="truncate">{displayText}</span>
        <svg
          className={`w-3.5 h-3.5 text-zinc-400 dark:text-zinc-400 shrink-0 transition-transform duration-200 ${
            open ? "rotate-180 text-blue-500" : ""
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
          className="bg-white dark:bg-[#121215] border border-zinc-200 dark:border-zinc-800 rounded-xl shadow-2xl p-1.5 space-y-0.5 animate-in fade-in zoom-in-95 duration-100 overflow-hidden font-sans"
        >
          <div className="overflow-y-auto overscroll-contain py-0.5 space-y-0.5 max-h-56">
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
                  className={`w-full text-left px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors duration-150 flex items-center justify-between gap-2 cursor-pointer ${
                    isSelected
                      ? "bg-blue-50 dark:bg-blue-950/40 text-blue-600 dark:text-blue-400 border border-blue-100 dark:border-blue-900/40 font-bold"
                      : "text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800/80 hover:text-zinc-900 dark:hover:text-white"
                  }`}
                >
                  <span className="truncate">{option.label}</span>
                  {isSelected && (
                    <svg
                      className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400 shrink-0 ml-1.5"
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
        </div>,
        document.body
      )}
    </div>
  );
}
