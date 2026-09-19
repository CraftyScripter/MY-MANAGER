"use client";
import { useMemo } from "react";
import DropdownSelect from "@/components/DropdownSelect";
import type { SyncStatus } from "../hooks/useLeadsStore";
import type { LeadColumn, Lead, LeadFile } from "../types";

interface ToolbarProps {
  search: string;
  onSearchChange: (v: string) => void;
  statusFilter: string;
  onStatusFilterChange: (v: string) => void;
  categoryFilter: string;
  onCategoryFilterChange: (v: string) => void;
  categories: string[];
  columns?: LeadColumn[];
  leads?: Lead[];
  columnFilters?: Record<string, string>;
  onColumnFilterChange?: (colKey: string, val: string) => void;
  hasExpandedFile: boolean;
  expandedFile?: LeadFile | null;
  onCloseExpandedFile?: () => void;
  loading: boolean;
  syncStatus: SyncStatus;
  onRefresh: () => void;
  onImport: () => void;
  onExport: () => void;
  onOpenGoogleSheets?: () => void;
  googleSheetUrl?: string | null;
  onNewFile?: () => void;
  onNewFolder?: () => void;
  canWrite?: boolean;
}

function SyncBadge({ status }: { status: SyncStatus }) {
  if (status === "idle") return null;

  return (
    <div className="flex items-center gap-1.5 text-xs transition-opacity duration-300">
      {status === "saving" && (
        <>
          <div className="w-3 h-3 border-2 border-zinc-500 border-t-zinc-300 rounded-full animate-spin" />
          <span className="text-zinc-400">Saving...</span>
        </>
      )}
      {status === "saved" && (
        <>
          <svg className="w-3.5 h-3.5 text-emerald-500 dark:text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
          </svg>
          <span className="text-emerald-600 dark:text-emerald-400 font-medium">Saved</span>
        </>
      )}
      {status === "error" && (
        <>
          <svg className="w-3.5 h-3.5 text-red-500 dark:text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
          </svg>
          <span className="text-red-600 dark:text-red-400 font-medium">Error saving</span>
        </>
      )}
    </div>
  );
}

const STATUS_OPTIONS = [
  { label: "All Status", value: "all" },
  { label: "New", value: "new" },
  { label: "Contacted", value: "contacted" },
  { label: "Qualified", value: "qualified" },
  { label: "Converted", value: "converted" },
  { label: "Dead", value: "dead" },
];

export default function Toolbar({
  search,
  onSearchChange,
  statusFilter,
  onStatusFilterChange,
  categoryFilter,
  onCategoryFilterChange,
  categories,
  columns = [],
  leads = [],
  columnFilters = {},
  onColumnFilterChange,
  hasExpandedFile,
  expandedFile,
  onCloseExpandedFile,
  loading,
  syncStatus,
  onRefresh,
  onImport,
  onExport,
  onOpenGoogleSheets,
  googleSheetUrl,
  canWrite = true,
}: ToolbarProps) {
  // Extract dynamic distinct options for custom/select columns
  const dynamicColumnOptions = useMemo(() => {
    if (!columns || columns.length === 0) return [];

    return columns
      .filter((col) => {
        if (!col?.name || typeof col.name !== "string") return false;
        const nameLower = col.name.toLowerCase().trim();
        return nameLower !== "status" && nameLower !== "category" && nameLower !== "businessname";
      })
      .map((col) => {
        let options: string[] = [];
        if (col.options) {
          const list = col.options.includes(",") ? col.options.split(",") : col.options.split("\n");
          options = list.map((s) => s.trim()).filter(Boolean);
        } else {
          // Gather unique non-empty values from leads
          const distinctSet = new Set<string>();
          leads.forEach((l) => {
            const custom = (l.customFields as Record<string, string>) || {};
            const v = custom[col.name] ?? (l as unknown as Record<string, string>)?.[col.name];
            if (v !== undefined && v !== null && String(v).trim().length > 0) {
              distinctSet.add(String(v).trim());
            }
          });
          options = Array.from(distinctSet);
        }

        return {
          columnKey: col.name,
          columnTitle: col.name,
          options,
        };
      })
      .filter((item) => item.options.length > 0 && item.options.length <= 30);
  }, [columns, leads]);

  if (!hasExpandedFile) return null;

  return (
    <div className="bg-white dark:bg-[#09090b] border-b border-zinc-200 dark:border-zinc-800 shrink-0">
      {/* Top Header Bar for Expanded Sheet */}
      <div className="px-4 sm:px-6 py-3 border-b border-zinc-200 dark:border-zinc-800 flex items-center justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-3 min-w-0">
          {onCloseExpandedFile && (
            <button
              onClick={onCloseExpandedFile}
              className="px-3 py-1.5 text-xs font-semibold text-zinc-700 dark:text-zinc-300 bg-white dark:bg-zinc-900 hover:bg-slate-50 dark:hover:bg-zinc-800 border border-zinc-200 dark:border-zinc-800 rounded-xl transition flex items-center gap-1.5 shadow-sm cursor-pointer shrink-0"
              title="Back to files"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 19.5L3 12m0 0l7.5-7.5M3 12h18" />
              </svg>
              <span>Back</span>
            </button>
          )}

          <div className="flex items-center gap-2.5 min-w-0">
            {googleSheetUrl ? (
              <a
                href={googleSheetUrl}
                target="_blank"
                rel="noreferrer"
                className="p-1.5 rounded-lg bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-100 dark:hover:bg-emerald-900/60 hover:scale-105 transition cursor-pointer shrink-0"
                title="Open in Google Sheets (External)"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
                </svg>
              </a>
            ) : (
              <span className="p-1.5 rounded-lg bg-blue-50 dark:bg-blue-950/40 text-blue-600 dark:text-blue-400 shrink-0">
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
                </svg>
              </span>
            )}
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <h2 className="text-sm font-bold text-zinc-900 dark:text-white truncate leading-tight">
                  {expandedFile?.name || "Spreadsheet"}
                </h2>
                {googleSheetUrl && (
                  <a
                    href={googleSheetUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-semibold bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-500/20 border border-emerald-500/20 transition cursor-pointer shrink-0"
                    title="Open Google Sheet in new tab"
                  >
                    <span>Open Sheet</span>
                    <svg className="w-2.5 h-2.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 6H5.25A2.25 2.25 0 003 8.25v10.5A2.25 2.25 0 005.25 21h10.5A2.25 2.25 0 0018 18.75V10.5m-10.5 6L21 3m0 0h-5.25M21 3v5.25" />
                    </svg>
                  </a>
                )}
              </div>
              {expandedFile?.description && (
                <p className="text-[11px] text-zinc-500 truncate leading-tight mt-0.5">
                  {expandedFile.description}
                </p>
              )}
            </div>
          </div>
        </div>

        {/* Right side sheet actions */}
        <div className="flex items-center gap-2 shrink-0">
          <SyncBadge status={syncStatus} />

          {!canWrite && (
            <div className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-blue-700 dark:text-blue-300 bg-blue-50 dark:bg-blue-950/70 border border-blue-200 dark:border-blue-800/60 rounded-xl shadow-xs">
              <svg className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M2.036 12.322a1.012 1.012 0 010-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178z" />
                <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
              <span>View Only</span>
            </div>
          )}

          {googleSheetUrl && (
            <a
              href={googleSheetUrl}
              target="_blank"
              rel="noreferrer"
              className="px-3 py-1.5 text-xs font-semibold text-emerald-700 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-950/40 hover:bg-emerald-100 dark:hover:bg-emerald-900/60 border border-emerald-200/80 dark:border-emerald-800/60 rounded-xl transition flex items-center gap-1.5 shadow-xs cursor-pointer"
              title="Open external spreadsheet in Google Sheets"
            >
              <svg className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 6H5.25A2.25 2.25 0 003 8.25v10.5A2.25 2.25 0 005.25 21h10.5A2.25 2.25 0 0018 18.75V10.5m-10.5 6L21 3m0 0h-5.25M21 3v5.25" />
              </svg>
              <span>Open in Google Sheets ↗</span>
            </a>
          )}

          {googleSheetUrl && onOpenGoogleSheets && (
            <button
              onClick={onOpenGoogleSheets}
              className="px-3 py-1.5 text-xs font-semibold text-zinc-700 dark:text-zinc-300 bg-white dark:bg-zinc-900 hover:bg-slate-50 dark:hover:bg-zinc-800 border border-zinc-200 dark:border-zinc-800 rounded-xl transition flex items-center gap-1.5 shadow-xs cursor-pointer"
              title="Manage Google Sheets live connections"
            >
              <svg className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
              </svg>
              <span>Sheets Sync</span>
            </button>
          )}

          {canWrite && (
            <button
              onClick={onImport}
              className="px-3 py-1.5 text-xs font-semibold text-zinc-700 dark:text-zinc-300 bg-white dark:bg-zinc-900 hover:bg-slate-50 dark:hover:bg-zinc-800 border border-zinc-200 dark:border-zinc-800 rounded-xl transition flex items-center gap-1.5 shadow-sm cursor-pointer"
              title="Import CSV"
            >
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5M16.5 12L12 16.5m0 0L7.5 12m4.5 4.5V3" />
              </svg>
              <span>Import</span>
            </button>
          )}

          <button
            onClick={onExport}
            className="px-3 py-1.5 text-xs font-semibold text-zinc-700 dark:text-zinc-300 bg-white dark:bg-zinc-900 hover:bg-slate-50 dark:hover:bg-zinc-800 border border-zinc-200 dark:border-zinc-800 rounded-xl transition flex items-center gap-1.5 shadow-sm cursor-pointer"
            title="Export CSV"
          >
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5M16.5 12L12 7.5m0 0L7.5 12m4.5-4.5v12" />
            </svg>
            <span>Export</span>
          </button>

          <button
            onClick={onRefresh}
            disabled={loading}
            className="px-3 py-1.5 text-xs font-semibold text-zinc-700 dark:text-zinc-300 bg-white dark:bg-zinc-900 hover:bg-slate-50 dark:hover:bg-zinc-800 border border-zinc-200 dark:border-zinc-800 rounded-xl transition flex items-center gap-1.5 shadow-sm cursor-pointer disabled:opacity-60"
            title="Refresh Data"
          >
            <svg className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0l3.181 3.183a8.25 8.25 0 0013.803-3.7M4.031 9.865a8.25 8.25 0 0113.803-3.7l3.181 3.182" />
            </svg>
            <span>Refresh</span>
          </button>
        </div>
      </div>

      {/* Filter Row */}
      <div className="px-4 sm:px-6 py-2.5 flex items-center gap-3 flex-wrap">
        <div className="relative flex-1 min-w-[200px] max-w-sm">
          <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-400 dark:text-zinc-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z" />
          </svg>
          <input
            type="text"
            placeholder="Search in sheet..."
            value={search}
            onChange={(e) => onSearchChange(e.target.value)}
            className="w-full bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl pl-10 pr-4 py-2 text-xs text-zinc-900 dark:text-zinc-300 placeholder:text-zinc-400 dark:placeholder:text-zinc-600 focus:outline-none focus:ring-2 focus:ring-blue-500/20 dark:focus:ring-zinc-700 hover:border-zinc-300 dark:hover:border-zinc-700 transition shadow-sm"
          />
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <DropdownSelect
            value={statusFilter}
            onChange={onStatusFilterChange}
            options={STATUS_OPTIONS}
            minWidth="150px"
          />

          {categories.length > 0 && (
            <DropdownSelect
              value={categoryFilter}
              onChange={onCategoryFilterChange}
              options={[
                { label: "All Categories", value: "all" },
                ...categories.map((c) => ({ label: c, value: c })),
              ]}
              minWidth="170px"
            />
          )}

          {dynamicColumnOptions.map((dyn) => {
            const currentVal = columnFilters[dyn.columnKey] || "all";
            const options = [
              { label: `${dyn.columnTitle}: All`, value: "all" },
              ...dyn.options.map((opt) => ({ label: opt, value: opt })),
            ];
            return (
              <DropdownSelect
                key={dyn.columnKey}
                value={currentVal}
                onChange={(val) => onColumnFilterChange?.(dyn.columnKey, val)}
                options={options}
                minWidth="160px"
              />
            );
          })}
        </div>
      </div>
    </div>
  );
}
