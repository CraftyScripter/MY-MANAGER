"use client";

import React from "react";

interface PageHeaderProps {
  title: string;
  subtitle?: string;
  children?: React.ReactNode;
  className?: string;
}

export default function PageHeader({
  title,
  subtitle,
  children,
  className = "",
}: PageHeaderProps) {
  return (
    <div className={`mb-6 pb-4 border-b border-zinc-200 dark:border-zinc-800 flex flex-col sm:flex-row sm:items-center justify-between gap-4 ${className}`}>
      <div>
        <h1 className="text-2xl font-bold text-zinc-900 dark:text-white tracking-tight flex items-center gap-2.5">
          {title}
        </h1>
        {subtitle && <p className="text-sm text-zinc-500 dark:text-zinc-400 mt-0.5">{subtitle}</p>}
      </div>
      {children && <div className="flex items-center gap-2.5 shrink-0">{children}</div>}
    </div>
  );
}
