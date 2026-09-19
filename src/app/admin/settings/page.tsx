"use client";

import { useState, useEffect, useMemo } from "react";
import { hasReadPermission, hasWritePermission } from "@/lib/permissions";
import ThemeToggle from "@/components/ThemeToggle";

interface UserProfile {
  id: string;
  name: string;
  email: string;
  phone?: string | null;
  role: string;
  permissions?: string[];
  image?: string | null;
}

const SECTION_LABELS: Record<string, string> = {
  leads: "Leads & Spreadsheets",
  forms: "Forms & Enquiries",
  credentials: "Password Manager",
  finance: "Finance & Payments",
  env: "Environment Variables",
  team: "Team Management",
  activity_log: "Activity Log",
  instagram: "Instagram Posts & Media",
  settings: "Settings",
};

export default function SettingsPage() {
  const [user, setUser] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState<{ type: "success" | "error"; message: string } | null>(null);

  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [profileSaving, setProfileSaving] = useState(false);

  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [passwordSaving, setPasswordSaving] = useState(false);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 4000);
    return () => clearTimeout(t);
  }, [toast]);

  useEffect(() => {
    fetch("/api/admin/auth/me")
      .then((r) => r.json())
      .then((data) => {
        if (data.user) {
          setUser(data.user);
          setName(data.user.name || "");
          setPhone(data.user.phone || "");
        }
      })
      .catch(() => setToast({ type: "error", message: "Failed to load profile" }))
      .finally(() => setLoading(false));
  }, []);

  const isAdmin = user?.id === "admin" || user?.role === "admin";

  // Group user permissions by unique section and determine effective permission level
  const assignedSections = useMemo(() => {
    if (!user?.permissions || !Array.isArray(user.permissions)) return [];

    const rawSections = new Set<string>();
    for (const p of user.permissions) {
      if (typeof p !== "string") continue;
      if (p.includes(":")) {
        rawSections.add(p.split(":")[0]);
      } else {
        rawSections.add(p);
      }
    }

    return Array.from(rawSections).map((section) => {
      const isAll = section === "all";
      const isWrite = hasWritePermission(user.permissions!, section);
      const isRead = hasReadPermission(user.permissions!, section);
      const label = isAll ? "All Sections" : (SECTION_LABELS[section] || section.charAt(0).toUpperCase() + section.slice(1));

      return {
        section,
        label,
        isWrite,
        isRead,
      };
    });
  }, [user?.permissions]);

  async function handleProfileSave() {
    if (!name.trim()) {
      setToast({ type: "error", message: "Name is required" });
      return;
    }

    setProfileSaving(true);
    try {
      const res = await fetch("/api/admin/auth/profile", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: name.trim(), phone: phone.trim() || null }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setToast({ type: "success", message: "Profile updated successfully" });
      if (user) {
        setUser({ ...user, name: name.trim(), phone: phone.trim() || null });
      }
      window.dispatchEvent(new Event("auth-user-updated"));
    } catch (err) {

      setToast({ type: "error", message: err instanceof Error ? err.message : "Failed to update profile" });
    } finally {
      setProfileSaving(false);
    }
  }

  async function handlePasswordChange() {
    if (!currentPassword) {
      setToast({ type: "error", message: "Current password is required" });
      return;
    }
    if (!newPassword) {
      setToast({ type: "error", message: "New password is required" });
      return;
    }
    if (newPassword.length < 6) {
      setToast({ type: "error", message: "New password must be at least 6 characters" });
      return;
    }
    if (newPassword !== confirmPassword) {
      setToast({ type: "error", message: "Passwords do not match" });
      return;
    }

    setPasswordSaving(true);
    try {
      const res = await fetch("/api/admin/auth/change-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ currentPassword, newPassword }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setToast({ type: "success", message: "Password changed successfully" });
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
    } catch (err) {
      setToast({ type: "error", message: err instanceof Error ? err.message : "Failed to change password" });
    } finally {
      setPasswordSaving(false);
    }
  }

  const [activeTab, setActiveTab] = useState<"general" | "profile" | "security" | "notifications">("general");

  // Notification settings state with localStorage persistence
  const [notifyLeads, setNotifyLeads] = useState(true);
  const [notifyForms, setNotifyForms] = useState(true);
  const [notifySecurity, setNotifySecurity] = useState(true);
  const [weeklyDigest, setWeeklyDigest] = useState(false);

  // Recent system notifications feed
  const [notificationsList, setNotificationsList] = useState<{
    id: string;
    title: string;
    description: string;
    timestamp: string;
    type: "form" | "lead" | "finance" | "security";
    href: string;
  }[]>([]);
  const [loadingNotifications, setLoadingNotifications] = useState(false);

  useEffect(() => {
    try {
      const saved = localStorage.getItem("pm_notification_prefs");
      if (saved) {
        const p = JSON.parse(saved);
        if (p.notifyLeads !== undefined) setNotifyLeads(p.notifyLeads);
        if (p.notifyForms !== undefined) setNotifyForms(p.notifyForms);
        if (p.notifySecurity !== undefined) setNotifySecurity(p.notifySecurity);
        if (p.weeklyDigest !== undefined) setWeeklyDigest(p.weeklyDigest);
      }
      if (typeof window !== "undefined") {
        const params = new URLSearchParams(window.location.search);
        const tab = params.get("tab");
        if (tab === "notifications" || tab === "profile" || tab === "security" || tab === "general") {
          setActiveTab(tab);
        }
      }
    } catch {}
  }, []);

  const handleTogglePref = (key: string, currentVal: boolean, setter: (val: boolean) => void) => {
    const newVal = !currentVal;
    setter(newVal);
    try {
      const saved = localStorage.getItem("pm_notification_prefs");
      const parsed = saved ? JSON.parse(saved) : {};
      parsed[key] = newVal;
      localStorage.setItem("pm_notification_prefs", JSON.stringify(parsed));
      setToast({ type: "success", message: "Notification preference updated" });
    } catch {}
  };

  useEffect(() => {
    if (activeTab === "notifications") {
      setLoadingNotifications(true);
      fetch("/api/admin/notifications")
        .then((r) => r.json())
        .then((data) => setNotificationsList(data.notifications || []))
        .catch(() => {})
        .finally(() => setLoadingNotifications(false));
    }
  }, [activeTab]);

  if (loading) {
    return (
      <div className="p-8 flex items-center justify-center min-h-[60vh]">
        <div className="w-7 h-7 border-2 border-zinc-600 border-t-white rounded-full animate-spin" />
      </div>
    );
  }

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
          {toast.type === "success" ? (
            <svg className="w-4 h-4 text-white shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
            </svg>
          ) : (
            <svg className="w-4 h-4 text-white shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z" />
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
                <path strokeLinecap="round" strokeLinejoin="round" d="M9.594 3.94c.09-.542.56-.94 1.11-.94h2.593c.55 0 1.02.398 1.11.94l.213 1.281c.063.374.313.686.645.87.074.04.147.083.22.127.324.196.72.257 1.075.124l1.217-.456a1.125 1.125 0 011.37.49l1.296 2.247a1.125 1.125 0 01-.26 1.431l-1.003.827c-.293.24-.438.613-.431.992a6.759 6.759 0 010 .255c-.007.378.138.75.43.99l1.005.828c.424.35.534.954.26 1.43l-1.298 2.247a1.125 1.125 0 01-1.369.491l-1.217-.456c-.355-.133-.75-.072-1.076.124a6.57 6.57 0 01-.22.128c-.331.183-.581.495-.644.869l-.213 1.28c-.09.543-.56.941-1.11.941h-2.594c-.55 0-1.02-.398-1.11-.94l-.213-1.281c-.062-.374-.312-.686-.644-.87a6.52 6.52 0 01-.22-.127c-.325-.196-.72-.257-1.076-.124l-1.217.456a1.125 1.125 0 01-1.369-.49l-1.297-2.247a1.125 1.125 0 01.26-1.431l1.004-.827c.292-.24.437-.613.43-.992a6.932 6.932 0 010-.255c.007-.378-.138-.75-.43-.99l-1.004-.828a1.125 1.125 0 01-.26-1.43l1.297-2.247a1.125 1.125 0 011.37-.491l1.216.456c.356.133.751.072 1.076-.124.072-.044.146-.087.22-.128.332-.183.582-.495.644-.869l.214-1.281z" />
                <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
            </span>
            {isAdmin ? "Settings" : "My Profile & Settings"}
          </h1>
          <p className="text-sm text-zinc-500 dark:text-zinc-400 mt-1">
            {isAdmin
              ? "Manage your workspace preferences, appearance, security keys, and account configuration."
              : "Manage your profile details, session credentials, and permissions overview."}
          </p>
        </div>

        <div className="flex items-center gap-2.5 shrink-0">
          <button
            onClick={() => window.location.reload()}
            className="flex items-center gap-2 px-3.5 py-2 text-xs font-semibold text-zinc-700 dark:text-zinc-200 bg-white dark:bg-[#111114] hover:bg-zinc-100 dark:hover:bg-zinc-800 border border-zinc-200 dark:border-zinc-800 hover:border-zinc-300 dark:hover:border-zinc-700 rounded-xl transition-all duration-150 cursor-pointer shadow-xs active:scale-97"
            title="Reload Settings"
          >
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0l3.181 3.183a8.25 8.25 0 0013.803-3.7M4.031 9.865a8.25 8.25 0 0113.803-3.7l3.181 3.182" />
            </svg>
            <span>Refresh</span>
          </button>
        </div>
      </div>

      {/* 2. Modern Tab Navigation Bar */}
      <div className="flex items-center gap-1.5 p-1 bg-slate-100 dark:bg-[#111114] border border-zinc-200 dark:border-zinc-800 rounded-2xl overflow-x-auto shadow-xs">
        {(
          [
            { id: "general", label: "General", icon: "M10.5 6h9.75M10.5 6a1.5 1.5 0 11-3 0m3 0a1.5 1.5 0 10-3 0M3.75 6H7.5m3 12h9.75m-9.75 0a1.5 1.5 0 01-3 0m3 0a1.5 1.5 0 00-3 0m-3.75 0H7.5m9-6h3.75m-3.75 0a1.5 1.5 0 01-3 0m3 0a1.5 1.5 0 00-3 0m-9.75 0h9.75" },
            { id: "profile", label: "Profile", icon: "M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0A17.933 17.933 0 0112 21.75c-2.676 0-5.216-.584-7.499-1.632z" },
            { id: "security", label: "Security", icon: "M16.5 10.5V6.75a4.5 4.5 0 10-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 002.25-2.25v-6.75a2.25 2.25 0 00-2.25-2.25H6.75a2.25 2.25 0 00-2.25 2.25v6.75a2.25 2.25 0 002.25 2.25z" },
            { id: "notifications", label: "Notifications", icon: "M14.857 17.082a23.848 23.848 0 005.454-1.31A8.967 8.967 0 0118 9.75v-.7V9A6 6 0 006 9v.75a8.967 8.967 0 01-2.312 6.022c1.733.64 3.56 1.085 5.455 1.31m5.714 0a24.255 24.255 0 01-5.714 0m5.714 0a3 3 0 11-5.714 0" },
          ] as const
        ).map((tab) => {
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold transition-all duration-150 cursor-pointer shrink-0 ${
                isActive
                  ? "bg-white text-zinc-900 shadow-xs border border-zinc-200/80 dark:bg-zinc-800 dark:text-zinc-100 dark:border-zinc-700/50"
                  : "text-zinc-600 hover:text-zinc-900 hover:bg-white/60 dark:text-zinc-400 dark:hover:text-zinc-200 dark:hover:bg-zinc-800/60 border border-transparent"
              }`}
            >
              <svg className="w-3.5 h-3.5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d={tab.icon} />
              </svg>
              <span>{tab.label}</span>
            </button>
          );
        })}
      </div>

      {/* 3. Tab Content Area */}

      {/* TAB: GENERAL */}
      {activeTab === "general" && (
        <div className="space-y-6">
          {/* Appearance & Theme Selector */}
          <div className="bg-white dark:bg-[#111114] border border-zinc-200 dark:border-zinc-800 rounded-2xl p-6 space-y-4 shadow-xs">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-xl bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/20 flex items-center justify-center">
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 3v2.25m6.364.386l-1.591 1.591M21 12h-2.25m-.386 6.364l-1.591-1.591M12 18.75V21m-4.773-4.227l-1.591 1.591M5.25 12H3m4.227-4.773L5.636 5.636M15.75 12a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0z" />
                </svg>
              </div>
              <div>
                <h2 className="text-sm font-bold text-zinc-900 dark:text-white">Appearance</h2>
                <p className="text-xs text-zinc-500 dark:text-zinc-400">Choose your preferred theme</p>
              </div>
            </div>

            <div className="max-w-xs">
              <ThemeToggle variant="segmented" />
            </div>
          </div>

          {/* Workspace Preferences */}
          <div className="bg-white dark:bg-[#111114] border border-zinc-200 dark:border-zinc-800 rounded-2xl p-6 space-y-4 shadow-xs">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-xl bg-purple-500/10 text-purple-600 dark:text-purple-400 border border-purple-500/20 flex items-center justify-center">
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6A2.25 2.25 0 016 3.75h2.25A2.25 2.25 0 0110.5 6v2.25a2.25 2.25 0 01-2.25 2.25H6a2.25 2.25 0 01-2.25-2.25V6zM3.75 15.75A2.25 2.25 0 016 13.5h2.25a2.25 2.25 0 012.25 2.25V18a2.25 2.25 0 01-2.25 2.25H6A2.25 2.25 0 013.75 18v-2.25zM13.5 6a2.25 2.25 0 012.25-2.25H18A2.25 2.25 0 0120.25 6v2.25A2.25 2.25 0 0118 10.5h-2.25a2.25 2.25 0 01-2.25-2.25V6zM13.5 15.75a2.25 2.25 0 012.25-2.25H18a2.25 2.25 0 012.25 2.25V18A2.25 2.25 0 0118 20.25h-2.25A2.25 2.25 0 0113.5 18v-2.25z" />
                </svg>
              </div>
              <div>
                <h2 className="text-sm font-bold text-zinc-900 dark:text-white">Workspace Information</h2>
                <p className="text-xs text-zinc-500 dark:text-zinc-400">Your account and workspace details</p>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
              <div className="p-4 rounded-xl bg-slate-50 dark:bg-zinc-900/50 border border-zinc-200 dark:border-zinc-800">
                <span className="text-xs text-zinc-500 dark:text-zinc-400">Account Type</span>
                <p className="text-sm font-semibold text-zinc-800 dark:text-zinc-200 mt-0.5">
                  {isAdmin ? "Administrator" : "Team Member"}
                </p>
              </div>
              <div className="p-4 rounded-xl bg-slate-50 dark:bg-zinc-900/50 border border-zinc-200 dark:border-zinc-800">
                <span className="text-xs text-zinc-500 dark:text-zinc-400">Email</span>
                <p className="text-sm font-semibold text-zinc-800 dark:text-zinc-200 mt-0.5 font-mono">{user?.email}</p>
              </div>
              {!isAdmin && assignedSections.length > 0 && (
                <div className="p-4 rounded-xl bg-slate-50 dark:bg-zinc-900/50 border border-zinc-200 dark:border-zinc-800">
                  <span className="text-xs text-zinc-500 dark:text-zinc-400">Assigned Sections</span>
                  <p className="text-sm font-semibold text-zinc-800 dark:text-zinc-200 mt-0.5">
                    {assignedSections.map((s) => s.label).join(", ")}
                  </p>
                </div>
              )}
              <div className="p-4 rounded-xl bg-slate-50 dark:bg-zinc-900/50 border border-zinc-200 dark:border-zinc-800">
                <span className="text-xs text-zinc-500 dark:text-zinc-400">Timezone</span>
                <p className="text-sm font-semibold text-zinc-800 dark:text-zinc-200 mt-0.5">
                  {Intl.DateTimeFormat().resolvedOptions().timeZone}
                </p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* TAB: PROFILE */}
      {activeTab === "profile" && (
        <div className="space-y-6">
          {/* Profile Hero Card */}
          <div className="bg-white dark:bg-[#111114] border border-zinc-200 dark:border-zinc-800 rounded-2xl p-6 shadow-xs">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-5">
              <div className="flex items-center gap-4">
                {user?.image ? (
                  <img
                    src={user.image}
                    alt={user?.name || "Profile"}
                    className="w-16 h-16 rounded-2xl object-cover border border-zinc-200 dark:border-zinc-700 shadow-md shrink-0"
                    referrerPolicy="no-referrer"
                  />
                ) : (
                  <div className="w-16 h-16 rounded-2xl bg-gradient-to-tr from-blue-600 to-indigo-600 border border-blue-500/30 flex items-center justify-center text-2xl font-extrabold text-white shrink-0 shadow-lg shadow-blue-500/20">
                    {(user?.name || "U").charAt(0).toUpperCase()}
                  </div>
                )}
                <div>
                  <div className="flex items-center gap-2.5 flex-wrap">
                    <h2 className="text-lg font-bold text-zinc-900 dark:text-white tracking-tight">{user?.name || "Team Member"}</h2>
                    <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold ${
                      isAdmin
                        ? "bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/30"
                        : "bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border border-indigo-500/30"
                    }`}>
                      <span className={`w-1.5 h-1.5 rounded-full ${isAdmin ? "bg-amber-500 dark:bg-amber-400" : "bg-indigo-500 dark:bg-indigo-400"}`} />
                      {isAdmin ? "Administrator" : "Team Member"}
                    </span>
                  </div>
                  <p className="text-xs text-zinc-500 dark:text-zinc-400 font-mono mt-1">{user?.email}</p>
                </div>
              </div>

              <div className="flex items-center flex-wrap gap-3">
                {!isAdmin && assignedSections.length > 0 && (
                  <div className="px-3.5 py-2 rounded-xl bg-white dark:bg-zinc-800/60 border border-zinc-200 dark:border-zinc-700/60 flex items-center gap-2 shadow-xs">
                    <span className="text-xs text-zinc-500 dark:text-zinc-400">Access:</span>
                    <span className="text-xs font-semibold text-zinc-800 dark:text-zinc-200">
                      {assignedSections.length} sections
                    </span>
                  </div>
                )}
                <div className="px-3.5 py-2 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-emerald-500" />
                  <span className="text-xs font-semibold text-emerald-600 dark:text-emerald-400">Active Account</span>
                </div>
              </div>
            </div>
          </div>

          {/* Personal Information Form */}
          <div className="bg-white dark:bg-[#111114] border border-zinc-200 dark:border-zinc-800 rounded-2xl p-6 space-y-5 shadow-xs">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-xl bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/20 flex items-center justify-center">
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0A17.933 17.933 0 0112 21.75c-2.676 0-5.216-.584-7.499-1.632z" />
                </svg>
              </div>
              <div>
                <h2 className="text-sm font-bold text-zinc-900 dark:text-white">Personal Information</h2>
                <p className="text-xs text-zinc-500 dark:text-zinc-400">Update your public name and telephone contact</p>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="text-xs text-zinc-700 dark:text-zinc-400 font-medium block mb-1.5">Email Address</label>
                <input
                  type="text"
                  value={user?.email || ""}
                  disabled
                  className="w-full bg-slate-50 dark:bg-zinc-800/40 border border-zinc-200 dark:border-zinc-800 rounded-xl px-4 py-2.5 text-xs text-zinc-700 dark:text-zinc-300 cursor-not-allowed font-mono shadow-xs"
                />
              </div>
              <div>
                <label className="text-xs text-zinc-700 dark:text-zinc-400 font-medium block mb-1.5">Full Name</label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  disabled={isAdmin}
                  placeholder="Your full name"
                  className="w-full bg-white dark:bg-[#111114] border border-zinc-300 dark:border-zinc-800 rounded-xl px-4 py-2.5 text-xs text-zinc-900 dark:text-zinc-200 placeholder:text-zinc-400 dark:placeholder:text-zinc-600 focus:outline-none focus:border-blue-500 dark:focus:border-blue-500 transition disabled:bg-slate-50 dark:disabled:bg-zinc-800/30 disabled:text-zinc-700 dark:disabled:text-zinc-300 disabled:border-zinc-200 dark:disabled:border-zinc-800 disabled:cursor-not-allowed shadow-xs"
                />
              </div>
              <div className="md:col-span-2">
                <label className="text-xs text-zinc-700 dark:text-zinc-400 font-medium block mb-1.5">Phone Number</label>
                <input
                  type="text"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  disabled={isAdmin}
                  placeholder="Phone number"
                  className="w-full bg-white dark:bg-[#111114] border border-zinc-300 dark:border-zinc-800 rounded-xl px-4 py-2.5 text-xs text-zinc-900 dark:text-zinc-200 placeholder:text-zinc-400 dark:placeholder:text-zinc-600 focus:outline-none focus:border-blue-500 dark:focus:border-blue-500 transition disabled:bg-slate-50 dark:disabled:bg-zinc-800/30 disabled:text-zinc-700 dark:disabled:text-zinc-300 disabled:border-zinc-200 dark:disabled:border-zinc-800 disabled:cursor-not-allowed shadow-xs"
                />
              </div>
            </div>

            {!isAdmin && (
              <div className="pt-3 border-t border-zinc-100 dark:border-zinc-800/60 flex justify-end">
                <button
                  onClick={handleProfileSave}
                  disabled={profileSaving}
                  className="px-4 py-2 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-500 rounded-xl transition-all duration-150 cursor-pointer shadow-xs active:scale-97 disabled:opacity-40"
                >
                  {profileSaving ? "Saving..." : "Save Profile"}
                </button>
              </div>
            )}
          </div>

          {/* Permissions Overview (for Team Members) */}
          {!isAdmin && assignedSections.length > 0 && (
            <div className="bg-white dark:bg-[#111114] border border-zinc-200 dark:border-zinc-800 rounded-2xl p-6 space-y-4 shadow-xs">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-xl bg-purple-500/10 text-purple-600 dark:text-purple-400 border border-purple-500/20 flex items-center justify-center">
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75m-3-7.036A11.959 11.959 0 013.598 6 11.99 11.99 0 003 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285z" />
                    </svg>
                  </div>
                  <div>
                    <h2 className="text-sm font-bold text-zinc-900 dark:text-white">Assigned Section Permissions</h2>
                    <p className="text-xs text-zinc-500 dark:text-zinc-400">Sections you have access to in this admin panel</p>
                  </div>
                </div>
                <span className="text-xs text-zinc-600 dark:text-zinc-400 bg-slate-100 dark:bg-zinc-800/80 px-2.5 py-1 rounded-lg border border-zinc-200 dark:border-zinc-700/50">
                  {assignedSections.length} active
                </span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3 pt-1">
                {assignedSections.map(({ section, label, isWrite }) => (
                  <div
                    key={section}
                    className="bg-slate-50 dark:bg-zinc-900/40 border border-zinc-200 dark:border-zinc-800 rounded-xl p-3 flex items-center justify-between gap-2"
                  >
                    <span className="text-xs font-medium text-zinc-800 dark:text-zinc-200 truncate">
                      {label}
                    </span>
                    <span
                      className={`inline-flex items-center px-2 py-0.5 rounded-md text-[11px] font-semibold shrink-0 ${
                        isWrite
                          ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30"
                          : "bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/30"
                      }`}
                    >
                      {isWrite ? "Read & Write" : "Read Only"}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* TAB: SECURITY */}
      {activeTab === "security" && (
        <div className="space-y-6">
          {/* Change Password Card */}
          <div className="bg-white dark:bg-[#111114] border border-zinc-200 dark:border-zinc-800 rounded-2xl p-6 space-y-5 shadow-xs">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-xl bg-purple-500/10 text-purple-600 dark:text-purple-400 border border-purple-500/20 flex items-center justify-center">
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 10.5V6.75a4.5 4.5 0 10-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 002.25-2.25v-6.75a2.25 2.25 0 00-2.25-2.25H6.75a2.25 2.25 0 00-2.25 2.25v6.75a2.25 2.25 0 002.25 2.25z" />
                </svg>
              </div>
              <div>
                <h2 className="text-sm font-bold text-zinc-900 dark:text-white">Change Account Password</h2>
                <p className="text-xs text-zinc-500 dark:text-zinc-400">Update your login security authentication credentials</p>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="text-xs text-zinc-500 dark:text-zinc-400 font-medium block mb-1.5">Current Password</label>
                <input
                  type="password"
                  value={currentPassword}
                  onChange={(e) => setCurrentPassword(e.target.value)}
                  placeholder="Enter current password"
                  className="w-full bg-white dark:bg-[#111114] border border-zinc-300 dark:border-zinc-800 rounded-xl px-4 py-2.5 text-xs text-zinc-900 dark:text-zinc-200 placeholder:text-zinc-400 dark:placeholder:text-zinc-600 focus:outline-none focus:border-zinc-400 dark:focus:border-zinc-600 transition shadow-xs"
                />
              </div>
              <div>
                <label className="text-xs text-zinc-500 dark:text-zinc-400 font-medium block mb-1.5">New Password</label>
                <input
                  type="password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="Min. 6 characters"
                  className="w-full bg-white dark:bg-[#111114] border border-zinc-300 dark:border-zinc-800 rounded-xl px-4 py-2.5 text-xs text-zinc-900 dark:text-zinc-200 placeholder:text-zinc-400 dark:placeholder:text-zinc-600 focus:outline-none focus:border-zinc-400 dark:focus:border-zinc-600 transition shadow-xs"
                />
              </div>
              <div>
                <label className="text-xs text-zinc-500 dark:text-zinc-400 font-medium block mb-1.5">Confirm Password</label>
                <input
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="Re-enter new password"
                  className="w-full bg-white dark:bg-[#111114] border border-zinc-300 dark:border-zinc-800 rounded-xl px-4 py-2.5 text-xs text-zinc-900 dark:text-zinc-200 placeholder:text-zinc-400 dark:placeholder:text-zinc-600 focus:outline-none focus:border-zinc-400 dark:focus:border-zinc-600 transition shadow-xs"
                />
              </div>
            </div>

            <div className="pt-3 border-t border-zinc-100 dark:border-zinc-800/60 flex justify-end">
              <button
                onClick={handlePasswordChange}
                disabled={passwordSaving}
                className="px-4 py-2 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-500 rounded-xl transition-all duration-150 cursor-pointer shadow-xs active:scale-97 disabled:opacity-40"
              >
                {passwordSaving ? "Saving..." : "Change Password"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* TAB: NOTIFICATIONS */}
      {activeTab === "notifications" && (
        <div className="space-y-6">
          {/* 1. Notification Preferences */}
          <div className="bg-white dark:bg-[#111114] border border-zinc-200 dark:border-zinc-800 rounded-2xl p-6 space-y-6 shadow-xs">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-xl bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20 flex items-center justify-center">
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M14.857 17.082a23.848 23.848 0 005.454-1.31A8.967 8.967 0 0118 9.75v-.7V9A6 6 0 006 9v.75a8.967 8.967 0 01-2.312 6.022c1.733.64 3.56 1.085 5.455 1.31m5.714 0a24.255 24.255 0 01-5.714 0m5.714 0a3 3 0 11-5.714 0" />
                </svg>
              </div>
              <div>
                <h2 className="text-sm font-bold text-zinc-900 dark:text-white">Alert Preferences</h2>
                <p className="text-xs text-zinc-500 dark:text-zinc-400">Configure which events trigger real-time notifications</p>
              </div>
            </div>

            <div className="divide-y divide-zinc-100 dark:divide-zinc-800/60">
              <div className="py-3.5 flex items-center justify-between">
                <div>
                  <p className="text-xs font-semibold text-zinc-900 dark:text-white">New Lead Submissions</p>
                  <p className="text-xs text-zinc-500 dark:text-zinc-400">Receive alerts when new client leads are captured</p>
                </div>
                <button
                  type="button"
                  onClick={() => handleTogglePref("notifyLeads", notifyLeads, setNotifyLeads)}
                  className={`w-11 h-6 rounded-full transition-colors relative cursor-pointer ${notifyLeads ? "bg-blue-600" : "bg-zinc-300 dark:bg-zinc-700"}`}
                >
                  <div className={`w-4 h-4 rounded-full bg-white absolute top-1 transition-transform ${notifyLeads ? "left-6" : "left-1"}`} />
                </button>
              </div>

              <div className="py-3.5 flex items-center justify-between">
                <div>
                  <p className="text-xs font-semibold text-zinc-900 dark:text-white">Form Enquiries & Contact Cards</p>
                  <p className="text-xs text-zinc-500 dark:text-zinc-400">Alert on new Promise Me and general contact form enquiries</p>
                </div>
                <button
                  type="button"
                  onClick={() => handleTogglePref("notifyForms", notifyForms, setNotifyForms)}
                  className={`w-11 h-6 rounded-full transition-colors relative cursor-pointer ${notifyForms ? "bg-blue-600" : "bg-zinc-300 dark:bg-zinc-700"}`}
                >
                  <div className={`w-4 h-4 rounded-full bg-white absolute top-1 transition-transform ${notifyForms ? "left-6" : "left-1"}`} />
                </button>
              </div>

              <div className="py-3.5 flex items-center justify-between">
                <div>
                  <p className="text-xs font-semibold text-zinc-900 dark:text-white">Security & Auth Alerts</p>
                  <p className="text-xs text-zinc-500 dark:text-zinc-400">Notify on login activity, privilege changes, and security events</p>
                </div>
                <button
                  type="button"
                  onClick={() => handleTogglePref("notifySecurity", notifySecurity, setNotifySecurity)}
                  className={`w-11 h-6 rounded-full transition-colors relative cursor-pointer ${notifySecurity ? "bg-blue-600" : "bg-zinc-300 dark:bg-zinc-700"}`}
                >
                  <div className={`w-4 h-4 rounded-full bg-white absolute top-1 transition-transform ${notifySecurity ? "left-6" : "left-1"}`} />
                </button>
              </div>

              <div className="py-3.5 flex items-center justify-between">
                <div>
                  <p className="text-xs font-semibold text-zinc-900 dark:text-white">Finance & Payment Updates</p>
                  <p className="text-xs text-zinc-500 dark:text-zinc-400">Alert on completed, pending, or refunded payment transactions</p>
                </div>
                <button
                  type="button"
                  onClick={() => handleTogglePref("weeklyDigest", weeklyDigest, setWeeklyDigest)}
                  className={`w-11 h-6 rounded-full transition-colors relative cursor-pointer ${weeklyDigest ? "bg-blue-600" : "bg-zinc-300 dark:bg-zinc-700"}`}
                >
                  <div className={`w-4 h-4 rounded-full bg-white absolute top-1 transition-transform ${weeklyDigest ? "left-6" : "left-1"}`} />
                </button>
              </div>
            </div>
          </div>

          {/* 2. Live Notification Inbox / Alert Log */}
          <div className="bg-white dark:bg-[#111114] border border-zinc-200 dark:border-zinc-800 rounded-2xl p-6 space-y-4 shadow-xs">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-xl bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/20 flex items-center justify-center">
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M21.75 6.75v10.5a2.25 2.25 0 01-2.25 2.25h-15a2.25 2.25 0 01-2.25-2.25V6.75m19.5 0A2.25 2.25 0 0019.5 4.5h-15a2.25 2.25 0 00-2.25 2.25m19.5 0v.243a2.25 2.25 0 01-1.07 1.916l-7.5 4.615a2.25 2.25 0 01-2.36 0L3.32 8.91a2.25 2.25 0 01-1.07-1.916V6.75" />
                  </svg>
                </div>
                <div>
                  <h2 className="text-sm font-bold text-zinc-900 dark:text-white">Recent Notification Feed</h2>
                  <p className="text-xs text-zinc-500 dark:text-zinc-400">Live alerts received across your workspace</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => {
                  setLoadingNotifications(true);
                  fetch("/api/admin/notifications")
                    .then((r) => r.json())
                    .then((data) => setNotificationsList(data.notifications || []))
                    .catch(() => {})
                    .finally(() => setLoadingNotifications(false));
                }}
                className="text-xs font-semibold text-blue-600 dark:text-blue-400 hover:underline cursor-pointer flex items-center gap-1"
              >
                Refresh Feed
              </button>
            </div>

            {loadingNotifications && notificationsList.length === 0 ? (
              <div className="py-12 flex items-center justify-center">
                <div className="w-5 h-5 border-2 border-zinc-400 dark:border-zinc-600 border-t-blue-600 rounded-full animate-spin" />
              </div>
            ) : notificationsList.length === 0 ? (
              <div className="py-10 text-center bg-slate-50 dark:bg-zinc-900/30 rounded-xl border border-zinc-200 dark:border-zinc-800">
                <p className="text-xs font-semibold text-zinc-700 dark:text-zinc-300">No recent notifications</p>
                <p className="text-[11px] text-zinc-400 mt-0.5">New leads, enquiries, and transactions will appear here automatically.</p>
              </div>
            ) : (
              <div className="divide-y divide-zinc-100 dark:divide-zinc-800/60 rounded-xl border border-zinc-200 dark:border-zinc-800 overflow-hidden">
                {notificationsList.map((item) => (
                  <div key={item.id} className="p-4 bg-slate-50/50 dark:bg-zinc-900/20 hover:bg-slate-50 dark:hover:bg-zinc-900/40 transition flex items-center justify-between gap-4">
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="w-8 h-8 rounded-lg bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/20 flex items-center justify-center shrink-0">
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M14.857 17.082a23.848 23.848 0 005.454-1.31A8.967 8.967 0 0118 9.75v-.7V9A6 6 0 006 9v.75a8.967 8.967 0 01-2.312 6.022c1.733.64 3.56 1.085 5.455 1.31m5.714 0a24.255 24.255 0 01-5.714 0m5.714 0a3 3 0 11-5.714 0" />
                        </svg>
                      </div>
                      <div className="min-w-0">
                        <p className="text-xs font-bold text-zinc-900 dark:text-white truncate">{item.title}</p>
                        <p className="text-xs text-zinc-500 dark:text-zinc-400 truncate">{item.description}</p>
                        <span className="text-[10px] text-zinc-400 mt-0.5 block">{new Date(item.timestamp).toLocaleString()}</span>
                      </div>
                    </div>
                    <a
                      href={item.href}
                      className="px-3 py-1.5 text-xs font-semibold text-zinc-700 dark:text-zinc-200 bg-white dark:bg-zinc-800 hover:bg-zinc-100 dark:hover:bg-zinc-700 border border-zinc-200 dark:border-zinc-700 rounded-lg transition shrink-0 cursor-pointer"
                    >
                      View
                    </a>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}


    </div>
  );
}




