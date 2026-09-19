"use client";

import React from "react";
import Link from "next/link";

interface EmptyStateProps {
  icon?: React.ReactNode;
  title: string;
  description?: string;
  action?: {
    label: string;
    onClick?: () => void;
    href?: string;
    icon?: React.ReactNode;
  };
  className?: string;
}

export default function EmptyState({
  icon,
  title,
  description,
  action,
  className = "",
}: EmptyStateProps) {
  return (
    <div className={`flex flex-col items-center justify-center text-center py-16 px-4 ${className}`}>
      <div className="w-12 h-12 bg-zinc-800/50 text-zinc-400 rounded-full flex items-center justify-center mb-3 border border-zinc-700/50">
        {icon || (
          <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M20.25 7.5l-.625 10.632a2.25 2.25 0 01-2.247 2.118H6.622a2.25 2.25 0 01-2.247-2.118L3.75 7.5m8.25 3v6.75m0 0l-3-3m3 3l3-3M3.375 7.5h17.25c.621 0 1.125-.504 1.125-1.125v-1.5c0-.621-.504-1.125-1.125-1.125H3.375c-.621 0-1.125.504-1.125 1.125v1.5c0 .621.504 1.125 1.125 1.125z" />
          </svg>
        )}
      </div>
      <h3 className="text-zinc-200 font-semibold text-base mb-1">{title}</h3>
      {description && <p className="text-zinc-400 text-sm max-w-sm mb-4">{description}</p>}
      {action && (
        action.href ? (
          <Link
            href={action.href}
            className="inline-flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white h-9 px-4 rounded-lg font-medium text-sm transition-colors cursor-pointer shadow-xs"
          >
            {action.icon}
            <span>{action.label}</span>
          </Link>
        ) : (
          <button
            type="button"
            onClick={action.onClick}
            className="inline-flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white h-9 px-4 rounded-lg font-medium text-sm transition-colors cursor-pointer shadow-xs"
          >
            {action.icon}
            <span>{action.label}</span>
          </button>
        )
      )}
    </div>
  );
}
