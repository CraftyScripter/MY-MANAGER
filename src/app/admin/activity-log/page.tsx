"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import Breadcrumbs from "@/components/Breadcrumbs";

interface ActivityLog {
  id: string;
  action: string;
  adminUser: string;
  userEmail?: string;
  userName?: string | null;
  section?: string;
  details: string | null;
  ipAddress?: string | null;
  createdAt: string;
  type: string;
}

interface Pagination {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

const SECTION_BADGES: Record<string, { label: string; class: string }> = {
  leads: { label: "Spreadsheets", class: "bg-emerald-50 dark:bg-emerald-950/50 text-emerald-700 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800/50" },
  forms: { label: "Forms", class: "bg-blue-50 dark:bg-blue-950/50 text-blue-700 dark:text-blue-400 border border-blue-200 dark:border-blue-800/50" },
  credentials: { label: "Password Manager", class: "bg-violet-50 dark:bg-violet-950/50 text-violet-700 dark:text-violet-400 border border-violet-200 dark:border-violet-800/50" },
  finance: { label: "Finance", class: "bg-amber-50 dark:bg-amber-950/50 text-amber-700 dark:text-amber-400 border border-amber-200 dark:border-amber-800/50" },
  payment: { label: "Finance", class: "bg-amber-50 dark:bg-amber-950/50 text-amber-700 dark:text-amber-400 border border-amber-200 dark:border-amber-800/50" },
  env: { label: "Environment Variables", class: "bg-purple-50 dark:bg-purple-950/50 text-purple-700 dark:text-purple-400 border border-purple-200 dark:border-purple-800/50" },
  team: { label: "Team", class: "bg-cyan-50 dark:bg-cyan-950/50 text-cyan-700 dark:text-cyan-400 border border-cyan-200 dark:border-cyan-800/50" },
  auth: { label: "Auth", class: "bg-rose-50 dark:bg-rose-950/50 text-rose-700 dark:text-rose-400 border border-rose-200 dark:border-rose-800/50" },
  settings: { label: "Settings", class: "bg-slate-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 border border-zinc-200 dark:border-zinc-700" },
};

const SECTIONS_FILTER = [
  { id: "all", label: "All Sections" },
  { id: "leads", label: "Spreadsheets" },
  { id: "forms", label: "Forms" },
  { id: "credentials", label: "Password Manager" },
  { id: "finance", label: "Finance" },
  { id: "env", label: "Environment Variables" },
  { id: "team", label: "Team" },
  { id: "auth", label: "Auth" },
  { id: "settings", label: "Settings" },
];

export default function ActivityLogPage() {
  const [logs, setLogs] = useState<ActivityLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [sectionFilter, setSectionFilter] = useState("all");
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [page, setPage] = useState(1);
  const [pagination, setPagination] = useState<Pagination>({ page: 1, limit: 50, total: 0, totalPages: 0 });
  const [refreshKey, setRefreshKey] = useState(0);
  const [selectedLog, setSelectedLog] = useState<ActivityLog | null>(null);
  const [toast, setToast] = useState<{ type: "success" | "error"; message: string } | null>(null);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 4000);
    return () => clearTimeout(t);
  }, [toast]);

  useEffect(() => {
    const t = setTimeout(() => {
      setDebouncedSearch(search);
      setPage(1);
    }, 300);
    return () => clearTimeout(t);
  }, [search]);

  const fetchLogs = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        page: String(page),
        limit: "50",
      });
      if (sectionFilter !== "all") params.set("section", sectionFilter);
      if (debouncedSearch.trim()) params.set("search", debouncedSearch.trim());

      const res = await fetch(`/api/admin/activity-log?${params.toString()}`);
      if (!res.ok) throw new Error("Failed to fetch activity logs");
      const data = await res.json();
      setLogs(data.logs || []);
      setPagination(data.pagination || { page: 1, limit: 50, total: 0, totalPages: 0 });
    } catch {
      setToast({ type: "error", message: "Failed to load activity logs" });
    } finally {
      setLoading(false);
    }
  }, [page, sectionFilter, debouncedSearch, refreshKey]);

  useEffect(() => {
    fetchLogs();
  }, [fetchLogs]);

  // Calculate quick stats
  const totalEvents = pagination.total || logs.length;
  const todayEvents = logs.filter(
    (l) => new Date(l.createdAt).toDateString() === new Date().toDateString()
  ).length;
  const authEvents = logs.filter(
    (l) => l.section === "auth" || l.type === "auth" || l.action.toLowerCase().includes("auth") || l.action.toLowerCase().includes("login")
  ).length;
  const uniqueUsers = new Set(logs.map((l) => l.adminUser)).size;

  return (
    <div className="w-full p-4 sm:p-6 lg:p-8 space-y-6">
      {/* Toast */}
      {toast && (
        <div
          className={`fixed bottom-6 right-6 z-[100] px-4 py-3 rounded-xl text-sm font-semibold shadow-2xl flex items-center gap-2.5 animate-in slide-in-from-bottom-3 fade-in duration-200 ${
            toast.type === "success"
              ? "bg-emerald-500 text-white"
              : "bg-red-500 text-white"
          }`}
        >
          {toast.type === "success" ? (
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
            </svg>
          ) : (
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          )}
          <span>{toast.message}</span>
        </div>
      )}

      {/* 1. Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-zinc-900 dark:text-white flex items-center gap-2.5">
            <span className="p-2 rounded-xl bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/20">
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </span>
            Activity Log
          </h1>
          <p className="text-sm text-zinc-500 dark:text-zinc-400 mt-1">
            Real-time audit trail and security telemetry of every administrative event.
          </p>
        </div>

        <div className="flex items-center gap-2.5 shrink-0">
          <button
            onClick={() => setRefreshKey((k) => k + 1)}
            className="flex items-center gap-2 px-3.5 py-2 text-xs font-semibold text-zinc-700 dark:text-zinc-200 bg-white dark:bg-[#111114] hover:bg-zinc-100 dark:hover:bg-zinc-800 border border-zinc-200 dark:border-zinc-800 hover:border-zinc-300 dark:hover:border-zinc-700 rounded-xl transition-all duration-150 cursor-pointer shadow-xs active:scale-97"
            title="Refresh Activity Logs"
          >
            <svg className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0l3.181 3.183a8.25 8.25 0 0013.803-3.7M4.031 9.865a8.25 8.25 0 0113.803-3.7l3.181 3.182" />
            </svg>
            <span>Refresh</span>
          </button>
        </div>
      </div>

      {/* 2. Summary KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Total Logs */}
        <div className="bg-white dark:bg-[#111114] border border-zinc-200 dark:border-zinc-800 rounded-2xl p-5 shadow-xs hover:border-zinc-300 dark:hover:border-zinc-700 transition-all">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider">Total Events</span>
            <span className="p-2 rounded-xl bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/20">
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 12h16.5m-16.5 3.75h16.5M3.75 19.5h16.5M5.625 4.5h12.75a1.875 1.875 0 010 3.75H5.625a1.875 1.875 0 010-3.75z" />
              </svg>
            </span>
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-2xl font-bold tracking-tight text-zinc-900 dark:text-white">{totalEvents}</span>
            <span className="text-xs text-zinc-400 font-medium">recorded</span>
          </div>
        </div>

        {/* Today's Events */}
        <div className="bg-white dark:bg-[#111114] border border-zinc-200 dark:border-zinc-800 rounded-2xl p-5 shadow-xs hover:border-zinc-300 dark:hover:border-zinc-700 transition-all">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider">Today's Events</span>
            <span className="p-2 rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
              <div className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse" />
            </span>
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-2xl font-bold tracking-tight text-emerald-600 dark:text-emerald-400">{todayEvents}</span>
            <span className="text-xs text-emerald-600/70 dark:text-emerald-400/70 font-medium">last 24h</span>
          </div>
        </div>

        {/* Security & Auth */}
        <div className="bg-white dark:bg-[#111114] border border-zinc-200 dark:border-zinc-800 rounded-2xl p-5 shadow-xs hover:border-zinc-300 dark:hover:border-zinc-700 transition-all">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider">Security & Auth</span>
            <span className="p-2 rounded-xl bg-purple-500/10 text-purple-600 dark:text-purple-400 border border-purple-500/20">
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 10.5V6.75a4.5 4.5 0 10-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 002.25-2.25v-6.75a2.25 2.25 0 00-2.25-2.25H6.75a2.25 2.25 0 00-2.25 2.25v6.75a2.25 2.25 0 002.25 2.25z" />
              </svg>
            </span>
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-2xl font-bold tracking-tight text-purple-600 dark:text-purple-400">{authEvents}</span>
            <span className="text-xs text-purple-600/70 dark:text-purple-400/70 font-medium">audit entries</span>
          </div>
        </div>

        {/* Active Actors */}
        <div className="bg-white dark:bg-[#111114] border border-zinc-200 dark:border-zinc-800 rounded-2xl p-5 shadow-xs hover:border-zinc-300 dark:hover:border-zinc-700 transition-all">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider">Active Actors</span>
            <span className="p-2 rounded-xl bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20">
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M15 19.128a9.38 9.38 0 002.625.372 9.337 9.337 0 004.121-.952 4.125 4.125 0 00-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 018.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0111.964-3.07M12 6.375a3.375 3.375 0 11-6.75 0 3.375 3.375 0 016.75 0zm8.25 2.25a2.625 2.625 0 11-5.25 0 2.625 2.625 0 015.25 0z" />
              </svg>
            </span>
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-2xl font-bold tracking-tight text-amber-600 dark:text-amber-400">{uniqueUsers}</span>
            <span className="text-xs text-amber-600/70 dark:text-amber-400/70 font-medium">collaborators</span>
          </div>
        </div>
      </div>

      {/* 3. Main Content Card / Filter Bar */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <svg className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-400 dark:text-zinc-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z" />
          </svg>
          <input
            type="text"
            placeholder="Search activity by user, action, or details..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full bg-white dark:bg-[#111114] border border-zinc-200 dark:border-zinc-800 rounded-xl pl-10 pr-4 py-2.5 text-xs text-zinc-900 dark:text-zinc-200 placeholder:text-zinc-400 dark:placeholder:text-zinc-500 focus:outline-none focus:border-zinc-400 dark:focus:border-zinc-600 transition shadow-xs"
          />
        </div>

        <div className="flex items-center gap-1 bg-slate-100 dark:bg-[#111114] border border-zinc-200 dark:border-zinc-800 rounded-xl p-1 shrink-0 overflow-x-auto shadow-xs">
          {SECTIONS_FILTER.map((sec) => (
            <button
              key={sec.id}
              onClick={() => {
                setSectionFilter(sec.id);
                setPage(1);
              }}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap transition-all duration-150 cursor-pointer shrink-0 ${
                sectionFilter === sec.id
                  ? "bg-white text-zinc-900 shadow-xs border border-zinc-200/80 dark:bg-zinc-800 dark:text-zinc-100 dark:border-zinc-700/50 font-semibold"
                  : "text-zinc-600 hover:text-zinc-900 hover:bg-white/60 dark:text-zinc-400 dark:hover:text-zinc-200 dark:hover:bg-zinc-800/60 border border-transparent"
              }`}
            >
              {sec.label}
            </button>
          ))}
        </div>
      </div>

      {/* Log Table */}
      <div className="bg-white dark:bg-[#111114] border border-zinc-200 dark:border-zinc-800 rounded-2xl overflow-hidden shadow-xs">
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <div className="w-6 h-6 border-2 border-zinc-400 dark:border-zinc-600 border-t-blue-600 dark:border-t-zinc-300 rounded-full animate-spin" />
          </div>
        ) : logs.length === 0 ? (
          <div className="text-center py-20">
            <svg className="w-12 h-12 mx-auto text-zinc-400 dark:text-zinc-700 mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <p className="text-zinc-500 text-sm">No activity records found</p>
          </div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-zinc-200 dark:border-zinc-800 text-xs uppercase tracking-wider text-zinc-600 dark:text-zinc-500 bg-slate-50 dark:bg-transparent">
                    <th className="text-left px-5 py-3.5 font-semibold">Date & Time</th>
                    <th className="text-left px-5 py-3.5 font-semibold">Section</th>
                    <th className="text-left px-5 py-3.5 font-semibold">Action</th>
                    <th className="text-left px-5 py-3.5 font-semibold">User</th>
                    <th className="text-left px-5 py-3.5 font-semibold">Details</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800/40">
                  {logs.map((log) => {
                    const badge = SECTION_BADGES[log.section || log.type] || {
                      label: log.section || log.type,
                      class: "bg-slate-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 border border-zinc-200 dark:border-zinc-700",
                    };

                    return (
                      <tr
                        key={log.id}
                        onClick={() => setSelectedLog(log)}
                        className="hover:bg-slate-50/80 dark:hover:bg-zinc-800/30 transition-colors cursor-pointer"
                      >
                        <td className="px-5 py-3.5 text-zinc-600 dark:text-zinc-400 whitespace-nowrap font-mono text-xs">
                          {new Date(log.createdAt).toLocaleString("en-US", {
                            month: "short",
                            day: "numeric",
                            year: "numeric",
                            hour: "2-digit",
                            minute: "2-digit",
                            second: "2-digit",
                          })}
                        </td>
                        <td className="px-5 py-3.5">
                          <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-medium ${badge.class}`}>
                            {badge.label}
                          </span>
                        </td>
                        <td className="px-5 py-3.5 text-zinc-900 dark:text-white font-medium capitalize">
                          {log.action.replace(/_/g, " ")}
                        </td>
                        <td className="px-5 py-3.5 text-zinc-700 dark:text-zinc-300 text-xs">
                          {log.adminUser}
                        </td>
                        <td className="px-5 py-3.5 text-zinc-500 dark:text-zinc-400 max-w-xs truncate text-xs font-mono">
                          {log.details || "—"}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {pagination.totalPages > 1 && (
              <div className="flex items-center justify-between px-6 py-4 border-t border-zinc-200 dark:border-zinc-800 text-xs">
                <p className="text-zinc-500">
                  Showing {((pagination.page - 1) * pagination.limit) + 1} to {Math.min(pagination.page * pagination.limit, pagination.total)} of {pagination.total} logs
                </p>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setPage(Math.max(1, page - 1))}
                    disabled={page === 1}
                    className="px-3 py-1.5 text-xs text-zinc-700 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white bg-white dark:bg-zinc-800 hover:bg-zinc-100 dark:hover:bg-zinc-700 border border-zinc-200 dark:border-zinc-700 disabled:opacity-40 disabled:cursor-not-allowed rounded-lg transition cursor-pointer"
                  >
                    Previous
                  </button>
                  {Array.from({ length: pagination.totalPages }, (_, i) => i + 1)
                    .filter((p) => p === 1 || p === pagination.totalPages || Math.abs(p - page) <= 1)
                    .reduce<(number | "ellipsis")[]>((acc, p, i, arr) => {
                      if (i > 0 && p - (arr[i - 1] as number) > 1) acc.push("ellipsis");
                      acc.push(p);
                      return acc;
                    }, [])
                    .map((item, i) =>
                      item === "ellipsis" ? (
                        <span key={`e${i}`} className="px-2 text-zinc-600">...</span>
                      ) : (
                        <button
                          key={item}
                          onClick={() => setPage(item)}
                          className={`w-7 h-7 rounded-lg transition cursor-pointer text-xs font-semibold ${
                            page === item ? "bg-blue-600 text-white font-bold shadow-xs border border-blue-600" : "text-zinc-700 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white bg-white dark:bg-zinc-900 hover:bg-zinc-100 dark:hover:bg-zinc-800 border border-zinc-200 dark:border-zinc-800"
                          }`}
                        >
                          {item}
                        </button>
                      )
                    )}
                  <button
                    onClick={() => setPage(Math.min(pagination.totalPages, page + 1))}
                    disabled={page === pagination.totalPages}
                    className="px-3 py-1.5 text-xs text-zinc-700 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white bg-white dark:bg-zinc-800 hover:bg-zinc-100 dark:hover:bg-zinc-700 border border-zinc-200 dark:border-zinc-700 disabled:opacity-40 disabled:cursor-not-allowed rounded-lg transition cursor-pointer"
                  >
                    Next
                  </button>
                </div>
              </div>
            )}
          </>
        )}
      </div>

      {/* Rich Activity Details Modal */}
      {selectedLog && (() => {
        let parsed: Record<string, unknown> | null = null;
        let isJson = false;
        try {
          if (selectedLog.details && (selectedLog.details.startsWith("{") || selectedLog.details.startsWith("["))) {
            parsed = JSON.parse(selectedLog.details);
            isJson = true;
          }
        } catch {}

        const clientMeta = parsed?._client as {
          browser?: string;
          os?: string;
          device?: string;
          location?: string;
          userAgent?: string;
        } | undefined;

        // Clean parameters without internal _client
        const businessParams: Record<string, unknown> = {};
        if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
          for (const [k, v] of Object.entries(parsed)) {
            if (k !== "_client") {
              businessParams[k] = v;
            }
          }
        }

        const formatKeyLabel = (key: string) => {
          const map: Record<string, string> = {
            columnId: "Column ID",
            fileId: "Sheet / File ID",
            folderId: "Folder ID",
            leadId: "Lead / Row ID",
            tabId: "Tab ID",
            previousValue: "Previous Value",
            newValue: "New Value",
            businessName: "Business Name",
            accountName: "Account Name",
            accountUrl: "Account URL",
            userName: "User Name",
            userEmail: "User Email",
            ipAddress: "IP Address",
            sourceUrl: "Source URL",
            customFields: "Custom Fields",
          };
          if (map[key]) return map[key];
          return key
            .replace(/([A-Z])/g, " $1")
            .replace(/_/g, " ")
            .replace(/^\w/, (c) => c.toUpperCase());
        };

        const badge = SECTION_BADGES[selectedLog.section || selectedLog.type] || {
          label: selectedLog.section || selectedLog.type,
          class: "bg-slate-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-400 border border-zinc-200 dark:border-zinc-700",
        };
        return (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 animate-in fade-in duration-150">
            <div className="bg-white dark:bg-[#111114] border border-zinc-200 dark:border-zinc-800 rounded-2xl w-full max-w-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
              {/* Header */}
              <div className="flex items-center justify-between px-6 py-4 border-b border-zinc-200 dark:border-zinc-800/80 bg-slate-50 dark:bg-zinc-900/50">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-xl bg-blue-50 dark:bg-blue-600/10 border border-blue-200 dark:border-blue-500/20 text-blue-600 dark:text-blue-400 flex items-center justify-center">
                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                    </svg>
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className="text-base font-bold text-zinc-900 dark:text-white capitalize">
                        {selectedLog.action.replace(/_/g, " ")}
                      </h3>
                      <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold ${badge.class}`}>
                        {badge.label}
                      </span>
                    </div>
                    <p className="text-xs text-zinc-500 dark:text-zinc-400 font-mono mt-0.5">
                      {new Date(selectedLog.createdAt).toLocaleString("en-US", {
                        dateStyle: "medium",
                        timeStyle: "medium",
                      })}
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => setSelectedLog(null)}
                  className="text-zinc-400 hover:text-zinc-700 dark:hover:text-white p-1.5 rounded-xl hover:bg-slate-200/60 dark:hover:bg-zinc-800 transition cursor-pointer"
                >
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>

              {/* Body */}
              <div className="p-6 space-y-5 overflow-y-auto flex-1">
                {/* User & Security Info Grid */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {/* User Profile Card */}
                  <div className="bg-slate-50 dark:bg-zinc-900/60 border border-zinc-200 dark:border-zinc-800/80 rounded-xl p-3.5 space-y-2">
                    <div className="flex items-center gap-2 text-xs font-semibold text-zinc-600 dark:text-zinc-400 uppercase tracking-wider">
                      <svg className="w-4 h-4 text-blue-600 dark:text-blue-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                      </svg>
                      <span>Actor / User</span>
                    </div>
                    <div className="space-y-1">
                      <div className="text-sm font-semibold text-zinc-900 dark:text-white">
                        {selectedLog.userName || selectedLog.adminUser?.split("(")[0]?.trim() || "Admin"}
                      </div>
                      <div className="text-xs text-zinc-500 dark:text-zinc-400 font-mono flex items-center gap-1.5">
                        <span className="truncate">{selectedLog.userEmail || selectedLog.adminUser}</span>
                      </div>
                    </div>
                  </div>

                  {/* Network & Location Card */}
                  <div className="bg-slate-50 dark:bg-zinc-900/60 border border-zinc-200 dark:border-zinc-800/80 rounded-xl p-3.5 space-y-2">
                    <div className="flex items-center gap-2 text-xs font-semibold text-zinc-600 dark:text-zinc-400 uppercase tracking-wider">
                      <svg className="w-4 h-4 text-emerald-600 dark:text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M3.055 11H5a2 2 0 012 2v1a2 2 0 002 2 2 2 0 012 2v2.945M8 3.935V5.5A2.5 2.5 0 0010.5 8h.5a2 2 0 012 2 2 2 0 104 0 2 2 0 012-2h1.064M15 20.488V18a2 2 0 012-2h3.064M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                      <span>Security & Location</span>
                    </div>
                    <div className="space-y-1 text-xs">
                      <div className="flex items-center justify-between">
                        <span className="text-zinc-500">IP Address:</span>
                        <span className="font-mono text-zinc-800 dark:text-zinc-200 bg-slate-200/80 dark:bg-zinc-800/80 px-2 py-0.5 rounded border border-zinc-300 dark:border-zinc-700/50">
                          {selectedLog.ipAddress || (clientMeta?.location === "Local / Internal Network" ? "127.0.0.1 (Localhost)" : "Localhost / Internal")}
                        </span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-zinc-500">Location:</span>
                        <span className="text-zinc-700 dark:text-zinc-300 font-medium">
                          {clientMeta?.location || (selectedLog.ipAddress === "::1" || selectedLog.ipAddress === "127.0.0.1" ? "Local Developer Machine" : "Global / Verified IP")}
                        </span>
                      </div>
                      {clientMeta && (
                        <div className="flex items-center justify-between">
                          <span className="text-zinc-500">Client / Device:</span>
                          <span className="text-zinc-700 dark:text-zinc-300">
                            {clientMeta.browser} • {clientMeta.os} ({clientMeta.device})
                          </span>
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                {/* Formatted Business Parameters */}
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs font-semibold text-zinc-600 dark:text-zinc-400 uppercase tracking-wider">Action Parameters & Data</span>
                  </div>

                  {isJson && Object.keys(businessParams).length > 0 ? (
                    <div className="bg-slate-50 dark:bg-zinc-900/70 border border-zinc-200 dark:border-zinc-800 rounded-xl divide-y divide-zinc-200 dark:divide-zinc-800/60 overflow-hidden text-xs">
                      {Object.entries(businessParams).map(([key, val]) => {
                        const isValueObj = typeof val === "object" && val !== null;
                        const displayVal = isValueObj ? JSON.stringify(val, null, 2) : String(val ?? "—");
                        const isId = key.toLowerCase().includes("id") && typeof val === "string" && val.length > 10;

                        return (
                          <div key={key} className="px-4 py-3 flex flex-col sm:flex-row sm:items-center justify-between gap-2 hover:bg-slate-100/60 dark:hover:bg-zinc-800/30 transition">
                            <span className="text-zinc-600 dark:text-zinc-400 font-medium min-w-[140px]">
                              {formatKeyLabel(key)}
                            </span>
                            <div className="flex items-center gap-2 max-w-full overflow-hidden">
                              {key === "previousValue" ? (
                                <span className="px-2 py-0.5 rounded bg-rose-50 dark:bg-rose-950/60 border border-rose-200 dark:border-rose-800/50 text-rose-700 dark:text-rose-300 font-mono truncate">
                                  {displayVal}
                                </span>
                              ) : key === "newValue" ? (
                                <span className="px-2 py-0.5 rounded bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-200 dark:border-emerald-800/50 text-emerald-700 dark:text-emerald-300 font-mono truncate">
                                  {displayVal}
                                </span>
                              ) : isId ? (
                                <span className="font-mono text-blue-700 dark:text-blue-400 bg-blue-50 dark:bg-blue-950/40 border border-blue-200 dark:border-blue-800/40 px-2 py-0.5 rounded truncate select-all">
                                  {displayVal}
                                </span>
                              ) : isValueObj ? (
                                <pre className="font-mono text-zinc-800 dark:text-zinc-300 bg-white dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 p-2 rounded-lg text-[11px] overflow-x-auto max-h-32 w-full">
                                  {displayVal}
                                </pre>
                              ) : (
                                <span className="text-zinc-900 dark:text-zinc-200 font-medium truncate">
                                  {displayVal}
                                </span>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    <div className="bg-slate-50 dark:bg-zinc-900/70 border border-zinc-200 dark:border-zinc-800 rounded-xl p-4 text-xs text-zinc-700 dark:text-zinc-300 font-mono whitespace-pre-wrap">
                      {selectedLog.details || "No additional parameters recorded for this action."}
                    </div>
                  )}
                </div>

                {/* Collapsible Raw JSON Details */}
                {selectedLog.details && (
                  <details className="group border border-zinc-200 dark:border-zinc-800/60 rounded-xl bg-slate-50 dark:bg-zinc-950/50">
                    <summary className="px-4 py-2.5 text-xs text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-300 cursor-pointer select-none font-medium flex items-center justify-between">
                      <span>View Raw Audit JSON</span>
                      <span className="text-[10px] text-zinc-500 group-open:rotate-180 transition">▼</span>
                    </summary>
                    <div className="p-3.5 pt-0 border-t border-zinc-200 dark:border-zinc-800/50">
                      <pre className="font-mono text-[11px] text-zinc-700 dark:text-zinc-400 bg-white dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800/50 p-3 rounded-lg overflow-x-auto max-h-48">
                        {isJson ? JSON.stringify(parsed, null, 2) : selectedLog.details}
                      </pre>
                    </div>
                  </details>
                )}
              </div>

              {/* Footer */}
              <div className="flex items-center justify-between px-6 py-4 border-t border-zinc-200 dark:border-zinc-800/80 bg-slate-50 dark:bg-zinc-900/30">
                <span className="text-[11px] text-zinc-500 dark:text-zinc-400 font-mono">
                  Log ID: {selectedLog.id}
                </span>
                <button
                  onClick={() => setSelectedLog(null)}
                  className="px-4 py-2 bg-slate-200 dark:bg-zinc-800 hover:bg-slate-300 dark:hover:bg-zinc-700 text-zinc-900 dark:text-white text-xs font-semibold rounded-xl transition cursor-pointer shadow-2xs"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        );
      })()}
    </div>
  );
}
