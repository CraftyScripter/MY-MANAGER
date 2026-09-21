"use client";

import { useState, useEffect, useRef } from "react";
import Link from "next/link";
import DropdownSelect from "@/components/DropdownSelect";

interface FinancialTrend {
  month: string;
  income: number;
  expenses: number;
}

interface TeamMember {
  id: string;
  name: string;
  email: string;
  role: string;
  isActive: boolean;
}

interface InstagramPost {
  id: string;
  caption?: string | null;
  mediaUrl: string;
  mediaType: string;
  status: string;
  createdAt: string;
}

interface InstagramAccount {
  id: string;
  username: string;
  followersCount?: number | null;
  followsCount?: number | null;
  mediaCount?: number | null;
}

interface FormBridgeProject {
  id: string;
  name: string;
  slug: string;
  isActive: boolean;
  createdAt: string;
}

interface DashboardStats {
  total: number;
  replied: number;
  pending: number;
  replyRate: number;
  formBridge?: {
    totalProjects: number;
    activeProjects: number;
    totalSubmissions: number;
    projects: FormBridgeProject[];
  };
  paymentSummary?: {
    totalIncome: number;
    totalExpenses: number;
    totalRefunds: number;
    netBalance: number;
    pendingAmount: number;
    financialTrends: FinancialTrend[];
  };
  totalCredentials?: number;
  totalEnvVars?: number;
  teamSummary?: {
    total: number;
    active: number;
    members: TeamMember[];
  };
  instagramSummary?: {
    accounts: number;
    published: number;
    scheduled: number;
    accountsList: InstagramAccount[];
    recentPosts: InstagramPost[];
  };
  recentActivities?: ActivityItem[];
}

interface ActivityItem {
  id: string;
  action: string;
  section: string;
  details?: string | null;
  userEmail: string;
  userName?: string | null;
  createdAt: string;
}

function formatActivityAction(action: string): string {
  if (!action) return "System Activity";
  const map: Record<string, string> = {
    login: "User Logged In",
    logout: "User Logged Out",
    INSTAGRAM_POST_PUBLISHED: "Instagram Post Published",
    INSTAGRAM_POST_SCHEDULED: "Instagram Post Scheduled",
    INSTAGRAM_POST_DELETED: "Instagram Post Deleted",
    INSTAGRAM_ACCOUNT_CONNECTED: "Instagram Connected",
    INSTAGRAM_ACCOUNT_DISCONNECTED: "Instagram Disconnected",
    CREATE_PAYMENT: "Payment Recorded",
    UPDATE_PAYMENT: "Payment Updated",
    DELETE_PAYMENT: "Payment Deleted",
    CREATE_CREDENTIAL: "Password Stored",
    UPDATE_CREDENTIAL: "Password Updated",
    DELETE_CREDENTIAL: "Password Deleted",
    IMPORT_LEADS: "Leads Imported",
    CREATE_LEAD: "Lead Created",
    UPDATE_LEAD: "Lead Updated",
    DELETE_LEAD: "Lead Deleted",
    CREATE_ENV: "Env Variable Added",
    UPDATE_ENV: "Env Variable Updated",
    DELETE_ENV: "Env Variable Deleted",
  };
  if (map[action]) return map[action];
  return action
    .toLowerCase()
    .replace(/_/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

function getActivitySubtitle(act: ActivityItem): string {
  let message = "";
  let role = "";
  if (act.details) {
    try {
      const parsed = JSON.parse(act.details);
      if (typeof parsed === "object" && parsed !== null) {
        if (typeof parsed.role === "string" && parsed.role.trim()) {
          role = parsed.role.trim();
        }
        if (typeof parsed.message === "string" && parsed.message.trim()) {
          message = parsed.message.trim();
        } else {
          const keys = Object.keys(parsed).filter((k) => k !== "_client" && k !== "role");
          if (keys.length > 0) {
            const firstKey = keys[0];
            const val = parsed[firstKey];
            if (typeof val === "string" || typeof val === "number" || typeof val === "boolean") {
              message = `${firstKey}: ${val}`;
            }
          }
        }
      }
    } catch {
      if (typeof act.details === "string" && act.details.trim()) {
        message = act.details.trim();
      }
    }
  }

  const actor = act.userName || (act.userEmail ? act.userEmail.split("@")[0] : null);
  const actorWithRole = actor ? (role ? `${actor} (${role})` : actor) : (role ? `(${role})` : null);

  if (message && actorWithRole) {
    return `${message} • by ${actorWithRole}`;
  }
  if (message) return message;
  if (actorWithRole) return `by ${actorWithRole}`;
  return act.section ? `Section: ${act.section}` : "System event";
}

function formatActivityTime(dateStr: string): string {
  try {
    const d = new Date(dateStr);
    const now = new Date();
    const diffSec = Math.floor((now.getTime() - d.getTime()) / 1000);
    if (diffSec < 60) return "Just now";
    const diffMin = Math.floor(diffSec / 60);
    if (diffMin < 60) return `${diffMin}m ago`;
    const diffHours = Math.floor(diffMin / 60);
    if (diffHours < 24) return `${diffHours}h ago`;
    const diffDays = Math.floor(diffHours / 24);
    if (diffDays === 1) return "Yesterday";
    if (diffDays < 7) return `${diffDays}d ago`;
    return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
  } catch {
    return "";
  }
}

function getActivityIconMeta(section: string) {
  const s = (section || "").toLowerCase();
  switch (s) {
    case "instagram":
      return {
        bg: "bg-pink-500/10 text-pink-600 dark:text-pink-400 border-pink-500/20",
        icon: (
          <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
            <rect x="2" y="2" width="20" height="20" rx="5" ry="5" />
            <circle cx="12" cy="12" r="4" />
          </svg>
        ),
      };
    case "leads":
      return {
        bg: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20",
        icon: (
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6A2.25 2.25 0 016 3.75h2.25A2.25 2.25 0 0110.5 6v2.25a2.25 2.25 0 01-2.25 2.25H6a2.25 2.25 0 01-2.25-2.25V6zM3.75 15.75A2.25 2.25 0 016 13.5h2.25a2.25 2.25 0 012.25 2.25V18a2.25 2.25 0 01-2.25 2.25H6A2.25 2.25 0 013.75 18v-2.25zM13.5 6a2.25 2.25 0 012.25-2.25H18A2.25 2.25 0 0120.25 6v2.25A2.25 2.25 0 0118 10.5h-2.25a2.25 2.25 0 01-2.25-2.25V6zM13.5 15.75a2.25 2.25 0 012.25-2.25H18a2.25 2.25 0 012.25 2.25V18A2.25 2.25 0 0118 20.25h-2.25A2.25 2.25 0 0113.5 18v-2.25z" />
          </svg>
        ),
      };
    case "forms":
      return {
        bg: "bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/20",
        icon: (
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
          </svg>
        ),
      };
    case "credentials":
      return {
        bg: "bg-violet-500/10 text-violet-600 dark:text-violet-400 border-violet-500/20",
        icon: (
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 10.5V6.75a4.5 4.5 0 10-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 002.25-2.25v-6.75a2.25 2.25 0 00-2.25-2.25H6.75a2.25 2.25 0 00-2.25 2.25v6.75a2.25 2.25 0 002.25 2.25z" />
          </svg>
        ),
      };
    case "finance":
    case "payment":
      return {
        bg: "bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20",
        icon: (
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v12m-3-2.818l.879.659c1.171.879 3.07.879 4.242 0 1.172-.879 1.172-2.303 0-3.182C13.536 12.219 12.768 12 12 12c-.725 0-1.45-.22-2.003-.659-1.106-.879-1.106-2.303 0-3.182s2.9-.879 4.006 0l.415.33M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        ),
      };
    case "env":
      return {
        bg: "bg-purple-500/10 text-purple-600 dark:text-purple-400 border-purple-500/20",
        icon: (
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M17.25 6.75L22.5 12l-5.25 5.25m-10.5 0L1.5 12l5.25-5.25m7.5-3l-4.5 16.5" />
          </svg>
        ),
      };
    case "team":
      return {
        bg: "bg-cyan-500/10 text-cyan-600 dark:text-cyan-400 border-cyan-500/20",
        icon: (
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 19.128a9.38 9.38 0 002.625.372 9.337 9.337 0 004.121-.952 4.125 4.125 0 00-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 018.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0111.964-3.07M12 6.375a3.375 3.375 0 11-6.75 0 3.375 3.375 0 016.75 0zm8.25 2.25a2.625 2.625 0 11-5.25 0 2.625 2.625 0 015.25 0z" />
          </svg>
        ),
      };
    case "auth":
      return {
        bg: "bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/20",
        icon: (
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 10.5V6.75a4.5 4.5 0 10-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 002.25-2.25v-6.75a2.25 2.25 0 00-2.25-2.25H6.75a2.25 2.25 0 00-2.25 2.25v6.75a2.25 2.25 0 002.25 2.25z" />
          </svg>
        ),
      };
    default:
      return {
        bg: "bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/20",
        icon: (
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 13.5l10.5-11.25L12 10.5h8.25L9.75 21.75 12 13.5H3.75z" />
          </svg>
        ),
      };
  }
}

export default function AdminPage() {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [timeRange, setTimeRange] = useState("30d");
  const [teamSearch, setTeamSearch] = useState("");
  const [toast, setToast] = useState<{ type: "success" | "error"; message: string } | null>(null);
  const [currentUser, setCurrentUser] = useState<{ role: string; name?: string; email?: string } | null>(null);

  const timeRangeOptions = [
    { label: "Last 7 Days", value: "7d" },
    { label: "Last 30 Days", value: "30d" },
    { label: "Last 90 Days", value: "90d" },
    { label: "This Year", value: "1y" },
  ];

  const lastDataSignatureRef = useRef<string>("");

  const fetchDashboardData = async (isBackground = false) => {
    if (!isBackground) setRefreshing(true);
    try {
      const res = await fetch(`/api/admin/stats?_t=${Date.now()}`, { cache: "no-store" });
      if (!res.ok) throw new Error("Failed to load statistics");
      const data: DashboardStats = await res.json();
      const signature = `${data.total}_${data.replied}_${data.pending}_${data.formBridge?.totalProjects}_${data.paymentSummary?.netBalance}_${data.teamSummary?.total}_${data.recentActivities?.[0]?.id || ""}`;
      if (isBackground && signature === lastDataSignatureRef.current) {
        return;
      }
      lastDataSignatureRef.current = signature;
      setStats(data);
    } catch {
      if (!isBackground) {
        setToast({ type: "error", message: "Failed to refresh dashboard data" });
      }
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetch("/api/admin/auth/me")
      .then((r) => r.json())
      .then((d) => { if (d.user) setCurrentUser(d.user); })
      .catch(() => {});
    fetchDashboardData(false);

    // 1. Silent background poll every 15 seconds
    const interval = setInterval(() => {
      if (document.hidden) return;
      fetchDashboardData(true);
    }, 15000);

    // 2. Instant sync when tab gains focus or becomes visible
    const handleFocus = () => fetchDashboardData(true);
    const handleVisibility = () => {
      if (document.visibilityState === "visible") fetchDashboardData(true);
    };

    window.addEventListener("focus", handleFocus);
    document.addEventListener("visibilitychange", handleVisibility);

    // 3. Cross-tab sync listener
    let bc: BroadcastChannel | null = null;
    try {
      bc = new BroadcastChannel("mm_calendar_sync");
      bc.onmessage = () => {
        fetchDashboardData(true);
      };
    } catch (_) {}

    return () => {
      clearInterval(interval);
      window.removeEventListener("focus", handleFocus);
      document.removeEventListener("visibilitychange", handleVisibility);
      if (bc) bc.close();
    };
  }, []);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 4000);
    return () => clearTimeout(t);
  }, [toast]);

  // Derived Values directly from real DB
  const netBalance = stats?.paymentSummary?.netBalance ?? 0;
  const totalIncome = stats?.paymentSummary?.totalIncome ?? 0;
  const totalExpenses = stats?.paymentSummary?.totalExpenses ?? 0;
  const totalSubmissions = stats?.total ?? 0;
  const replyRate = stats?.replyRate ?? 0;
  const formBridgeProjects = stats?.formBridge?.totalProjects ?? 0;
  const formBridgeActive = stats?.formBridge?.activeProjects ?? 0;
  const formBridgeSubmissions = stats?.formBridge?.totalSubmissions ?? 0;
  const financialTrends = stats?.paymentSummary?.financialTrends || [];
  const teamMembers = stats?.teamSummary?.members || [];
  const recentActivities = stats?.recentActivities || [];
  const instagramPosts = stats?.instagramSummary?.recentPosts || [];
  const instagramAccounts = stats?.instagramSummary?.accountsList || [];

  // Filtered team members for live search
  const filteredTeam = teamMembers.filter((m) =>
    m.name.toLowerCase().includes(teamSearch.toLowerCase()) ||
    m.email.toLowerCase().includes(teamSearch.toLowerCase()) ||
    m.role.toLowerCase().includes(teamSearch.toLowerCase())
  );

  return (
    <div className="w-full p-4 sm:p-6 lg:p-8 space-y-6">
      {/* Toast Notification */}
      {toast && (
        <div
          className={`fixed bottom-6 right-6 z-[100] px-4 py-3 rounded-xl text-sm font-semibold shadow-2xl flex items-center gap-2.5 animate-in slide-in-from-bottom-3 fade-in duration-200 ${
            toast.type === "success"
              ? "bg-emerald-600 text-white border border-emerald-500"
              : "bg-red-600 text-white border border-red-500"
          }`}
        >
          <span>{toast.message}</span>
        </div>
      )}

      {/* 1. Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-zinc-900 dark:text-white flex items-center gap-2.5">
            <span className="p-2 rounded-xl bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/20">
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6A2.25 2.25 0 016 3.75h2.25A2.25 2.25 0 0110.5 6v2.25a2.25 2.25 0 01-2.25 2.25H6a2.25 2.25 0 01-2.25-2.25V6zM3.75 15.75A2.25 2.25 0 016 13.5h2.25a2.25 2.25 0 012.25 2.25V18a2.25 2.25 0 01-2.25 2.25H6A2.25 2.25 0 013.75 18v-2.25zM13.5 6a2.25 2.25 0 012.25-2.25H18A2.25 2.25 0 0120.25 6v2.25A2.25 2.25 0 0118 10.5h-2.25a2.25 2.25 0 01-2.25-2.25V6zM13.5 15.75a2.25 2.25 0 012.25-2.25H18a2.25 2.25 0 012.25 2.25V18A2.25 2.25 0 0118 20.25h-2.25A2.25 2.25 0 0113.5 18v-2.25z" />
              </svg>
            </span>
            Executive Dashboard
            {currentUser && (
              <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-lg text-[10px] font-bold uppercase tracking-wider border ${
                currentUser.role === "admin"
                  ? "bg-purple-500/10 text-purple-600 dark:text-purple-400 border-purple-500/20"
                  : "bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/20"
              }`}>
                {currentUser.role === "admin" ? (
                  <>
                    <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M10.868 2.884c-.321-.772-1.415-.772-1.736 0l-1.83 4.401-4.753.381c-.833.067-1.171 1.107-.536 1.651l3.62 3.102 1.106 4.637c.12.513-.453.913-.875.67L4.5 14.127l-3.973 2.134c-.453.245-1.002-.134-.885-.64l1.05-4.496L.393 9.473c-.656-.563-.306-1.535.53-1.602l4.753-.381 1.83-4.401z" clipRule="evenodd" /></svg>
                    Admin
                  </>
                ) : (
                  <>
                    <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20"><path d="M10 9a3 3 0 100-6 3 3 0 000 6zm-7 9a7 7 0 1114 0H3z" /></svg>
                    Team Member
                  </>
                )}
              </span>
            )}
          </h1>
          <p className="text-sm text-zinc-500 dark:text-zinc-400 mt-1">
            Real-time cross-workspace analytics, operational telemetry, and financial performance.
          </p>
        </div>

        <div className="flex items-center gap-2.5 shrink-0">
          <div className="w-36">
            <DropdownSelect
              options={timeRangeOptions}
              value={timeRange}
              onChange={setTimeRange}
            />
          </div>

          <button
            onClick={() => fetchDashboardData(false)}
            disabled={refreshing}
            className="flex items-center gap-2 px-3.5 py-2 text-xs font-semibold text-zinc-700 dark:text-zinc-200 bg-white dark:bg-[#111114] hover:bg-zinc-100 dark:hover:bg-zinc-800 hover:border-zinc-300 dark:hover:border-zinc-700 border border-zinc-200 dark:border-zinc-800 rounded-xl transition-all duration-150 cursor-pointer shadow-xs active:scale-97 disabled:opacity-60"
          >
            <svg
              className={`w-3.5 h-3.5 ${refreshing ? "animate-spin" : ""}`}
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2}
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0l3.181 3.183a8.25 8.25 0 0013.803-3.7M4.031 9.865a8.25 8.25 0 0113.803-3.7l3.181 3.182"
              />
            </svg>
            <span>{refreshing ? "Refreshing..." : "Refresh"}</span>
          </button>
        </div>
      </div>

      {/* 2. SUMMARY KPI METRICS ROW */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Card 1: Net Balance */}
        <div className="p-5 bg-white dark:bg-[#111114] border border-zinc-200 dark:border-zinc-800 rounded-2xl shadow-xs hover:border-zinc-300 dark:hover:border-zinc-700 transition-all flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider">Net Balance</span>
              <span className="p-2 rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v12m-3-2.818l.879.659c1.171.879 3.07.879 4.242 0 1.172-.879 1.172-2.303 0-3.182C13.536 12.219 12.768 12 12 12c-.725 0-1.45-.22-2.003-.659-1.106-.879-1.106-2.303 0-3.182s2.9-.879 4.006 0l.415.33M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </span>
            </div>
            <div className="mt-3 flex items-baseline gap-2">
              <span className={`text-2xl font-bold tracking-tight ${netBalance >= 0 ? "text-emerald-600 dark:text-emerald-400" : "text-rose-600 dark:text-rose-400"}`}>
                ₹{netBalance.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </span>
            </div>
          </div>
          <div className="mt-3 pt-3 border-t border-zinc-100 dark:border-zinc-800/60 flex items-center justify-between text-xs">
            <span className="text-zinc-400">Total Inflow</span>
            <span className="font-semibold text-emerald-600 dark:text-emerald-400">
              ₹{totalIncome.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </span>
          </div>
        </div>

        {/* Card 2: Total Form Submissions */}
        <div className="p-5 bg-white dark:bg-[#111114] border border-zinc-200 dark:border-zinc-800 rounded-2xl shadow-xs hover:border-zinc-300 dark:hover:border-zinc-700 transition-all flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider">Form Submissions</span>
            <span className="p-2 rounded-xl bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/20">
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
              </svg>
            </span>
          </div>

          <div className="mt-3">
            <p className="text-2xl font-bold text-zinc-900 dark:text-white">{totalSubmissions}</p>
            <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-1">{replyRate}% replied inquiries</p>
          </div>
          <div className="mt-3 pt-3 border-t border-zinc-100 dark:border-zinc-800/60 flex items-center justify-between text-xs">
            <span className="text-zinc-400">Pending Actions</span>
            <span className="font-semibold text-amber-600 dark:text-amber-400">{stats?.pending ?? 0}</span>
          </div>
        </div>

        {/* Card 3: FormBridge Projects */}
        <div className="p-5 bg-white dark:bg-[#111114] border border-zinc-200 dark:border-zinc-800 rounded-2xl shadow-xs hover:border-zinc-300 dark:hover:border-zinc-700 transition-all flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider">FormBridge</span>
            <span className="p-2 rounded-xl bg-purple-500/10 text-purple-600 dark:text-purple-400 border border-purple-500/20">
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M13.19 8.688a4.5 4.5 0 011.242 7.244l-4.5 4.5a4.5 4.5 0 01-6.364-6.364l1.757-1.757m9.86-4.257a4.5 4.5 0 00-6.364-6.364L4.5 7.5l4.5 4.5-1.757 1.757a4.5 4.5 0 006.364 6.364l4.5-4.5a4.5 4.5 0 00-.324-.693z" />
              </svg>
            </span>
          </div>

          <div className="mt-3">
            <p className="text-2xl font-bold text-zinc-900 dark:text-white">{formBridgeProjects}</p>
            <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-1">{formBridgeSubmissions} total submissions</p>
          </div>
          <div className="mt-3 pt-3 border-t border-zinc-100 dark:border-zinc-800/60 flex items-center justify-between text-xs">
            <span className="text-zinc-400">Active Projects</span>
            <span className="font-semibold text-purple-600 dark:text-purple-400">{formBridgeActive}</span>
          </div>
        </div>

        {/* Card 4: Total Finance Outflow */}
        <div className="p-5 bg-white dark:bg-[#111114] border border-zinc-200 dark:border-zinc-800 rounded-2xl shadow-xs hover:border-zinc-300 dark:hover:border-zinc-700 transition-all flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider">Total Expenses</span>
            <span className="p-2 rounded-xl bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/20">
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 18.75a60.07 60.07 0 0115.797 2.101c.727.198 1.453-.342 1.453-1.096V18.75M3.75 4.5v.75A.75.75 0 013 6H2.25m0 0H3m-1.5 0h.75m1.5 0h16.5m0 0h.75m-.75 0V4.5m0 2.25H21a.75.75 0 00.75-.75V4.5m0 2.25v13.5a2.25 2.25 0 01-2.25 2.25H5.25a2.25 2.25 0 01-2.25-2.25V6" />
              </svg>
            </span>
          </div>

          <div className="mt-3">
            <p className="text-2xl font-bold text-rose-600 dark:text-rose-400">
              ₹{totalExpenses.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </p>
            <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-1">Total operational expenditure</p>
          </div>
          <div className="mt-3 pt-3 border-t border-zinc-100 dark:border-zinc-800/60 flex items-center justify-between text-xs">
            <span className="text-zinc-400">Pending Settlements</span>
            <span className="font-semibold text-amber-600 dark:text-amber-400">
              ₹{(stats?.paymentSummary?.pendingAmount ?? 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </span>
          </div>
        </div>
      </div>

      {/* 3. VISUALIZATION SECTION */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Chart: Real Income vs Expense Trend */}
        <div className="lg:col-span-7 p-6 bg-white dark:bg-[#111114] border border-zinc-200 dark:border-zinc-800 rounded-2xl shadow-xs flex flex-col justify-between">
          <div className="flex items-center justify-between pb-4 border-b border-zinc-100 dark:border-zinc-800/60">
            <div>
              <h2 className="text-sm font-bold text-zinc-900 dark:text-white">Income vs. Expense Trend</h2>
              <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5">Monthly cash flow and expense velocity from database</p>
            </div>

            <div className="flex items-center gap-4 text-xs font-semibold">
              <span className="flex items-center gap-1.5 text-zinc-700 dark:text-zinc-300">
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-500" />
                Income
              </span>
              <span className="flex items-center gap-1.5 text-zinc-700 dark:text-zinc-300">
                <span className="w-2.5 h-2.5 rounded-full bg-rose-500" />
                Expenses
              </span>
            </div>
          </div>

          <div className="py-6 min-h-[220px] flex items-center justify-center">
            {financialTrends.length > 0 ? (
              <div className="w-full space-y-4">
                {financialTrends.map((trend, idx) => {
                  const maxVal = Math.max(...financialTrends.map((t) => Math.max(t.income, t.expenses)), 1);
                  const incomePct = (trend.income / maxVal) * 100;
                  const expensePct = (trend.expenses / maxVal) * 100;

                  return (
                    <div key={idx} className="space-y-1.5">
                      <div className="flex items-center justify-between text-xs font-semibold">
                        <span className="text-zinc-700 dark:text-zinc-300">{trend.month}</span>
                        <div className="flex items-center gap-3">
                          <span className="text-emerald-600 dark:text-emerald-400">₹{trend.income.toLocaleString()}</span>
                          <span className="text-rose-500 dark:text-rose-400">₹{trend.expenses.toLocaleString()}</span>
                        </div>
                      </div>
                      <div className="space-y-1">
                        <div className="w-full bg-zinc-100 dark:bg-zinc-800/60 h-2 rounded-full overflow-hidden">
                          <div
                            style={{ width: `${Math.max(incomePct, 2)}%` }}
                            className="bg-emerald-500 h-full rounded-full transition-all duration-500"
                          />
                        </div>
                        <div className="w-full bg-zinc-100 dark:bg-zinc-800/60 h-2 rounded-full overflow-hidden">
                          <div
                            style={{ width: `${Math.max(expensePct, 2)}%` }}
                            className="bg-rose-500 h-full rounded-full transition-all duration-500"
                          />
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="text-center py-8">
                <div className="w-12 h-12 rounded-2xl bg-zinc-100 dark:bg-zinc-800/80 border border-zinc-200 dark:border-zinc-700/60 flex items-center justify-center mx-auto mb-3 text-zinc-400">
                  <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v12m-3-2.818l.879.659c1.171.879 3.07.879 4.242 0 1.172-.879 1.172-2.303 0-3.182C13.536 12.219 12.768 12 12 12c-.725 0-1.45-.22-2.003-.659-1.106-.879-1.106-2.303 0-3.182s2.9-.879 4.006 0l.415.33M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </div>
                <p className="text-sm font-semibold text-zinc-800 dark:text-zinc-200">No transactions recorded yet</p>
                <p className="text-xs text-zinc-400 mt-1 mb-3">Add finance records to visualize cash flow & expenditure trends.</p>
                <Link
                  href="/admin/payments"
                  className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold shadow-xs transition-all active:scale-97"
                >
                  Go to Finance →
                </Link>
              </div>
            )}
          </div>
        </div>

        {/* Right: FormBridge Projects Overview */}
        <div className="lg:col-span-5 p-6 bg-white dark:bg-[#111114] border border-zinc-200 dark:border-zinc-800 rounded-2xl shadow-xs flex flex-col justify-between">
          <div className="flex items-center justify-between pb-3 border-b border-zinc-100 dark:border-zinc-800/60">
            <div>
              <h2 className="text-sm font-bold text-zinc-900 dark:text-white">FormBridge Projects</h2>
              <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5">Multi-site form endpoints and submission status</p>
            </div>
            <Link href="/admin/forms" className="text-[11px] font-semibold text-purple-500 hover:underline">
              Manage →
            </Link>
          </div>

          <div className="py-4 flex-1 flex flex-col justify-between">
            {stats?.formBridge?.projects && stats.formBridge.projects.length > 0 ? (
              <div className="space-y-2.5">
                {stats.formBridge.projects.slice(0, 5).map((project) => (
                  <Link
                    key={project.id}
                    href={`/admin/forms/${project.id}`}
                    className="p-3 rounded-xl bg-slate-50 dark:bg-zinc-900/40 border border-zinc-100 dark:border-zinc-800/50 flex items-center justify-between hover:border-purple-300 dark:hover:border-purple-700 transition group"
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <div className="w-8 h-8 rounded-lg bg-purple-500/10 text-purple-500 border border-purple-500/20 flex items-center justify-center shrink-0">
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M13.19 8.688a4.5 4.5 0 011.242 7.244l-4.5 4.5a4.5 4.5 0 01-6.364-6.364l1.757-1.757m9.86-4.257a4.5 4.5 0 00-6.364-6.364L4.5 7.5l4.5 4.5-1.757 1.757a4.5 4.5 0 006.364 6.364l4.5-4.5a4.5 4.5 0 00-.324-.693z" />
                        </svg>
                      </div>
                      <div className="min-w-0">
                        <p className="text-xs font-semibold text-zinc-900 dark:text-white truncate group-hover:text-purple-600 dark:group-hover:text-purple-400 transition">
                          {project.name}
                        </p>
                        <p className="text-[10px] text-zinc-400 font-mono truncate">/api/forms/{project.slug}/submit</p>
                      </div>
                    </div>
                    <span
                      className={`w-2 h-2 rounded-full shrink-0 ${
                        project.isActive ? "bg-emerald-500" : "bg-zinc-400"
                      }`}
                    />
                  </Link>
                ))}
              </div>
            ) : (
              <div className="text-center py-6">
                <div className="w-12 h-12 rounded-2xl bg-purple-500/10 border border-purple-500/20 text-purple-500 flex items-center justify-center mx-auto mb-3">
                  <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
                  </svg>
                </div>
                <p className="text-sm font-semibold text-zinc-800 dark:text-zinc-200">No projects yet</p>
                <p className="text-xs text-zinc-400 mt-1 mb-3">Create your first FormBridge project to start collecting form submissions.</p>
                <Link
                  href="/admin/forms"
                  className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-purple-600 hover:bg-purple-500 text-white text-xs font-semibold shadow-xs transition-all active:scale-97"
                >
                  Create Project →
                </Link>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* 4. REAL FEEDS & TEAM STATUS */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Card 1: Instagram Account & Media Feed */}
        <div className="p-5 bg-white dark:bg-[#111114] border border-zinc-200 dark:border-zinc-800 rounded-2xl shadow-xs flex flex-col">
          <div>
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-bold text-zinc-900 dark:text-white">Instagram Media Feed</h2>
              <Link href="/admin/instagram" className="text-[11px] font-semibold text-rose-500 hover:underline">
                Manage →
              </Link>
            </div>
            <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5">
              {instagramAccounts.length > 0 ? `@${instagramAccounts[0].username}` : "Account & post sync"}
            </p>
          </div>

          <div className="pt-3 flex-1 flex flex-col justify-start">
            {instagramPosts.length > 0 ? (
              <div className="space-y-2">
                {instagramPosts.slice(0, 5).map((post) => (
                  <div key={post.id} className="p-2.5 rounded-xl bg-slate-50 dark:bg-zinc-900/50 border border-zinc-200 dark:border-zinc-800/60 hover:border-zinc-300 dark:hover:border-zinc-700 transition flex items-center justify-between gap-3">
                    <div className="flex items-center gap-2.5 truncate">
                      <div className="w-8 h-8 rounded-lg bg-pink-500/10 text-pink-500 border border-pink-500/20 flex items-center justify-center shrink-0">
                        <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                          <rect x="2" y="2" width="20" height="20" rx="5" ry="5" />
                          <circle cx="12" cy="12" r="4" />
                        </svg>
                      </div>
                      <span className="text-xs text-zinc-800 dark:text-zinc-200 truncate font-medium">
                        {post.caption || "Instagram Post"}
                      </span>
                    </div>
                    <span className={`px-2 py-0.5 rounded-md text-[10px] font-semibold shrink-0 ${
                      post.status === "published"
                        ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20"
                        : "bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20"
                    }`}>
                      {post.status}
                    </span>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-6">
                <p className="text-xs text-zinc-400 mb-2">No scheduled or published posts</p>
                <Link
                  href="/admin/instagram"
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-pink-600 hover:bg-pink-500 text-white text-xs font-semibold transition-all active:scale-97"
                >
                  Create Post →
                </Link>
              </div>
            )}
          </div>
        </div>

        {/* Card 2: Recent System Activity Feed */}
        <div className="p-5 bg-white dark:bg-[#111114] border border-zinc-200 dark:border-zinc-800 rounded-2xl shadow-xs flex flex-col">
          <div>
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-bold text-zinc-900 dark:text-white">Recent System Activity Feed</h2>
              <Link href="/admin/activity-log" className="text-[11px] font-semibold text-blue-500 hover:underline">
                Logs →
              </Link>
            </div>
            <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5">Real-time audit trail across modules</p>
          </div>

          <div className="pt-3 flex-1 flex flex-col justify-start">
            {recentActivities.length > 0 ? (
              <div className="space-y-2">
                {recentActivities.slice(0, 5).map((act) => {
                  const sectionMeta = getActivityIconMeta(act.section);
                  const formattedTitle = formatActivityAction(act.action);
                  const subtitle = getActivitySubtitle(act);
                  const timeStr = formatActivityTime(act.createdAt);

                  return (
                    <Link
                      key={act.id}
                      href="/admin/activity-log"
                      className="p-2.5 rounded-xl bg-slate-50 dark:bg-zinc-900/50 border border-zinc-200 dark:border-zinc-800/60 hover:border-zinc-300 dark:hover:border-zinc-700 hover:bg-slate-100/70 dark:hover:bg-zinc-800/50 transition flex items-center justify-between gap-3 group"
                    >
                      <div className="flex items-center gap-2.5 min-w-0 flex-1">
                        <div className={`w-8 h-8 rounded-lg ${sectionMeta.bg} border flex items-center justify-center shrink-0`}>
                          {sectionMeta.icon}
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="text-xs font-semibold text-zinc-900 dark:text-white truncate group-hover:text-blue-600 dark:group-hover:text-blue-400 transition">
                            {formattedTitle}
                          </p>
                          <p className="text-[10px] text-zinc-500 dark:text-zinc-400 truncate mt-0.5">
                            {subtitle}
                          </p>
                        </div>
                      </div>
                      <span className="text-[10px] font-medium text-zinc-400 dark:text-zinc-500 shrink-0 tabular-nums">
                        {timeStr}
                      </span>
                    </Link>
                  );
                })}
              </div>
            ) : (
              <div className="text-center py-6">
                <p className="text-xs text-zinc-400 mb-2">No activity logged yet</p>
                <Link
                  href="/admin/activity-log"
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold transition-all active:scale-97"
                >
                  View Activity Logs →
                </Link>
              </div>
            )}
          </div>
        </div>

        {/* Card 3: Real Team Status */}
        <div className="p-5 bg-white dark:bg-[#111114] border border-zinc-200 dark:border-zinc-800 rounded-2xl shadow-xs flex flex-col">
          <div>
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-bold text-zinc-900 dark:text-white">Team Status</h2>
              <Link href="/admin/team" className="text-[11px] font-semibold text-indigo-500 hover:underline">
                Manage →
              </Link>
            </div>
            <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5">
              {stats?.teamSummary?.active ?? 0} of {stats?.teamSummary?.total ?? 0} team members active
            </p>
          </div>

          <div className="pt-3 flex-1 flex flex-col space-y-2.5">
            <div className="relative">
              <input
                type="text"
                value={teamSearch}
                onChange={(e) => setTeamSearch(e.target.value)}
                placeholder="Search team member..."
                className="w-full pl-8 pr-3 py-1.5 bg-slate-50 dark:bg-zinc-900/60 border border-zinc-200 dark:border-zinc-800 rounded-xl text-xs text-zinc-900 dark:text-white placeholder:text-zinc-400 focus:outline-none focus:border-zinc-400"
              />
              <svg
                className="w-3.5 h-3.5 text-zinc-400 absolute left-2.5 top-2"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
            </div>

            <div className="space-y-1.5 flex-1 overflow-y-auto max-h-[260px] pr-0.5">
              {filteredTeam.length > 0 ? (
                filteredTeam.slice(0, 5).map((member) => (
                  <div key={member.id} className="p-2 rounded-xl bg-slate-50 dark:bg-zinc-900/40 border border-zinc-100 dark:border-zinc-800/50 flex items-center justify-between hover:border-zinc-300 dark:hover:border-zinc-700 transition">
                    <div className="flex items-center gap-2 truncate">
                      <div className="w-6 h-6 rounded-full bg-blue-600 text-white font-bold text-[10px] flex items-center justify-center shrink-0">
                        {member.name.charAt(0).toUpperCase()}
                      </div>
                      <div className="truncate">
                        <p className="text-xs font-semibold text-zinc-900 dark:text-white truncate">{member.name}</p>
                        <p className="text-[10px] text-zinc-400 truncate">{member.email}</p>
                      </div>
                    </div>
                    <span className={`px-1.5 py-0.5 rounded text-[9px] font-semibold uppercase ${
                      member.role === "admin"
                        ? "bg-purple-500/10 text-purple-600 dark:text-purple-400 border border-purple-500/20"
                        : "bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/20"
                    }`}>
                      {member.role}
                    </span>
                  </div>
                ))
              ) : (
                <div className="text-center py-4">
                  <p className="text-xs text-zinc-400">No matching team members</p>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* 5. QUICK ACTIONS */}
      <div className="space-y-3 pt-2">
        <h2 className="text-xs font-bold text-zinc-400 uppercase tracking-wider">Quick Actions</h2>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
          <Link
            href="/admin/forms"
            className="p-5 bg-white dark:bg-[#111114] hover:bg-zinc-50 dark:hover:bg-zinc-800/80 border border-zinc-200 dark:border-zinc-800 rounded-2xl transition-all duration-150 group flex flex-col items-center text-center justify-center gap-2.5 shadow-xs active:scale-97"
          >
            <div className="w-11 h-11 rounded-xl bg-purple-500/10 text-purple-600 dark:text-purple-400 border border-purple-500/20 flex items-center justify-center group-hover:scale-110 transition">
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M13.19 8.688a4.5 4.5 0 011.242 7.244l-4.5 4.5a4.5 4.5 0 01-6.364-6.364l1.757-1.757m9.86-4.257a4.5 4.5 0 00-6.364-6.364L4.5 7.5l4.5 4.5-1.757 1.757a4.5 4.5 0 006.364 6.364l4.5-4.5a4.5 4.5 0 00-.324-.693z" />
              </svg>
            </div>
            <div>
              <p className="text-xs font-bold text-zinc-900 dark:text-white">FormBridge</p>
              <p className="text-[11px] text-zinc-400 mt-0.5">Form endpoints</p>
            </div>
          </Link>

          <Link
            href="/admin/env"
            className="p-5 bg-white dark:bg-[#111114] hover:bg-zinc-50 dark:hover:bg-zinc-800/80 border border-zinc-200 dark:border-zinc-800 rounded-2xl transition-all duration-150 group flex flex-col items-center text-center justify-center gap-2.5 shadow-xs active:scale-97"
          >
            <div className="w-11 h-11 rounded-xl bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20 flex items-center justify-center group-hover:scale-110 transition">
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M17.25 6.75L22.5 12l-5.25 5.25m-10.5 0L1.5 12l5.25-5.25m7.5-3l-4.5 16.5" />
              </svg>
            </div>
            <div>
              <p className="text-xs font-bold text-zinc-900 dark:text-white">Environment Keys</p>
              <p className="text-[11px] text-zinc-400 mt-0.5">Secrets management</p>
            </div>
          </Link>

          <Link
            href="/admin/instagram"
            className="p-5 bg-white dark:bg-[#111114] hover:bg-zinc-50 dark:hover:bg-zinc-800/80 border border-zinc-200 dark:border-zinc-800 rounded-2xl transition-all duration-150 group flex flex-col items-center text-center justify-center gap-2.5 shadow-xs active:scale-97"
          >
            <div className="w-11 h-11 rounded-xl bg-pink-500/10 text-pink-600 dark:text-pink-400 border border-pink-500/20 flex items-center justify-center group-hover:scale-110 transition">
              <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75}>
                <rect x="2" y="2" width="20" height="20" rx="5" ry="5" />
                <path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z" />
                <line x1="17.5" y1="6.5" x2="17.51" y2="6.5" strokeWidth={2.5} strokeLinecap="round" />
              </svg>
            </div>
            <div>
              <p className="text-xs font-bold text-zinc-900 dark:text-white">Instagram Hub</p>
              <p className="text-[11px] text-zinc-400 mt-0.5">Schedule & upload</p>
            </div>
          </Link>

          <Link
            href="/admin/payments"
            className="p-5 bg-white dark:bg-[#111114] hover:bg-zinc-50 dark:hover:bg-zinc-800/80 border border-zinc-200 dark:border-zinc-800 rounded-2xl transition-all duration-150 group flex flex-col items-center text-center justify-center gap-2.5 shadow-xs active:scale-97"
          >
            <div className="w-11 h-11 rounded-xl bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/20 flex items-center justify-center group-hover:scale-110 transition">
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v12m-3-2.818l.879.659c1.171.879 3.07.879 4.242 0 1.172-.879 1.172-2.303 0-3.182C13.536 12.219 12.768 12 12 12c-.725 0-1.45-.22-2.003-.659-1.106-.879-1.106-2.303 0-3.182s2.9-.879 4.006 0l.415.33M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <div>
              <p className="text-xs font-bold text-zinc-900 dark:text-white">Finance & Ledger</p>
              <p className="text-[11px] text-zinc-400 mt-0.5">Transactions log</p>
            </div>
          </Link>

          <Link
            href="/admin/credentials"
            className="p-5 bg-white dark:bg-[#111114] hover:bg-zinc-50 dark:hover:bg-zinc-800/80 border border-zinc-200 dark:border-zinc-800 rounded-2xl transition-all duration-150 group flex flex-col items-center text-center justify-center gap-2.5 shadow-xs active:scale-97"
          >
            <div className="w-11 h-11 rounded-xl bg-violet-500/10 text-violet-600 dark:text-violet-400 border border-violet-500/20 flex items-center justify-center group-hover:scale-110 transition">
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 10.5V6.75a4.5 4.5 0 10-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 002.25-2.25v-6.75a2.25 2.25 0 00-2.25-2.25H6.75a2.25 2.25 0 00-2.25 2.25v6.75a2.25 2.25 0 002.25 2.25z" />
              </svg>
            </div>
            <div>
              <p className="text-xs font-bold text-zinc-900 dark:text-white">Password Vault</p>
              <p className="text-[11px] text-zinc-400 mt-0.5">Encrypted credentials</p>
            </div>
          </Link>
        </div>
      </div>
    </div>
  );
}
