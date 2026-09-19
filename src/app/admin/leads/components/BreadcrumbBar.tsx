"use client";
import type { LeadFolder, LeadFile } from "../types";

interface BreadcrumbBarProps {
  folderPath: LeadFolder[];
  expandedFile: LeadFile | null;
  onNavigateToRoot: () => void;
  onNavigateToFolder: (folder: LeadFolder) => void;
}

export default function BreadcrumbBar({
  folderPath,
  expandedFile,
  onNavigateToRoot,
  onNavigateToFolder,
}: BreadcrumbBarProps) {
  return (
    <div className="px-6 py-3 border-b border-zinc-200 dark:border-zinc-800/50 flex items-center gap-2">
      <button onClick={onNavigateToRoot} className="text-sm text-zinc-500 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white transition cursor-pointer">
        Leads
      </button>
      {folderPath.map((folder, index) => {
        const isCurrent = !expandedFile && index === folderPath.length - 1;
        return (
          <span key={folder.id} className="flex items-center gap-2">
            <svg className="w-4 h-4 text-zinc-400 dark:text-zinc-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
            </svg>
            <button
              onClick={() => onNavigateToFolder(folder)}
              className={`text-sm transition cursor-pointer ${
                isCurrent ? "text-zinc-900 dark:text-white font-medium" : "text-zinc-500 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white"
              }`}
            >
              {folder.name}
            </button>
          </span>
        );
      })}
      {expandedFile && (
        <span className="flex items-center gap-2">
          <svg className="w-4 h-4 text-zinc-400 dark:text-zinc-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
          </svg>
          <span className="text-sm text-zinc-900 dark:text-white font-medium">{expandedFile.name}</span>
        </span>
      )}
    </div>
  );
}
