"use client";
import { useEffect } from "react";

export interface ConfirmModalProps {
  isOpen: boolean;
  title: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  confirmVariant?: "danger" | "warning" | "primary";
  isLoading?: boolean;
  onConfirm: () => void | Promise<void>;
  onClose: () => void;
}

export default function ConfirmModal({
  isOpen,
  title,
  message,
  confirmText = "Delete",
  cancelText = "Cancel",
  confirmVariant = "danger",
  isLoading = false,
  onConfirm,
  onClose,
}: ConfirmModalProps) {
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        onClose();
      } else if (e.key === "Enter" && !isLoading) {
        onConfirm();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, isLoading, onConfirm, onClose]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 animate-in fade-in duration-150">
      <div
        className="fixed inset-0"
        onClick={() => {
          if (!isLoading) onClose();
        }}
      />
      <div className="relative bg-white dark:bg-[#18181b] border border-zinc-200 dark:border-zinc-700/80 rounded-2xl w-full max-w-sm mx-4 shadow-2xl p-5 z-10 animate-in fade-in zoom-in-95 duration-150">
        <div className="flex items-start gap-3.5">
          <div
            className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${
              confirmVariant === "danger"
                ? "bg-red-50 dark:bg-red-950/60 border border-red-200 dark:border-red-800/60 text-red-600 dark:text-red-400"
                : confirmVariant === "warning"
                ? "bg-amber-50 dark:bg-amber-950/60 border border-amber-200 dark:border-amber-800/60 text-amber-600 dark:text-amber-400"
                : "bg-blue-50 dark:bg-blue-950/60 border border-blue-200 dark:border-blue-800/60 text-blue-600 dark:text-blue-400"
            }`}
          >
            {confirmVariant === "danger" ? (
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0" />
              </svg>
            ) : (
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
              </svg>
            )}
          </div>

          <div className="flex-1 min-w-0">
            <h3 className="text-base font-semibold text-zinc-900 dark:text-white tracking-tight">{title}</h3>
            <p className="text-xs text-zinc-600 dark:text-zinc-400 mt-1 leading-relaxed">{message}</p>
          </div>
        </div>

        <div className="flex justify-end items-center gap-2 mt-5 pt-3 border-t border-zinc-100 dark:border-zinc-800">
          <button
            type="button"
            onClick={onClose}
            disabled={isLoading}
            className="px-3.5 py-1.5 text-xs text-zinc-700 dark:text-zinc-300 hover:text-zinc-900 dark:hover:text-white bg-slate-100 dark:bg-zinc-800 hover:bg-slate-200 dark:hover:bg-zinc-700 border border-zinc-200 dark:border-zinc-700 rounded-lg transition cursor-pointer disabled:opacity-40"
          >
            {cancelText}
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={isLoading}
            className={`flex items-center gap-1.5 px-4 py-1.5 text-xs font-medium rounded-lg transition cursor-pointer disabled:opacity-40 shadow-xs ${
              confirmVariant === "danger"
                ? "text-white bg-red-600 hover:bg-red-500"
                : confirmVariant === "warning"
                ? "text-black bg-amber-400 hover:bg-amber-300"
                : "text-white bg-blue-600 hover:bg-blue-500"
            }`}
          >
            {isLoading && (
              <div className="w-3 h-3 border-2 border-white/40 border-t-white rounded-full animate-spin" />
            )}
            <span>{confirmText}</span>
          </button>
        </div>
      </div>
    </div>
  );
}
