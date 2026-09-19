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

  const [activeTab, setActiveTab] = useState<"general" | "profile" | "security" | "notifications" | "integrations">("general");

  // Mock Notification settings state for UI completeness
  const [notifyLeads, setNotifyLeads] = useState(true);
  const [notifyForms, setNotifyForms] = useState(true);
  const [notifySecurity, setNotifySecurity] = useState(true);
  const [weeklyDigest, setWeeklyDigest] = useState(false);

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
            { id: "integrations", label: "Integrations", icon: "M13.19 8.688a4.5 4.5 0 011.242 7.244l-4.5 4.5a4.5 4.5 0 01-6.364-6.364l1.757-1.757m13.35-.622l1.757-1.757a4.5 4.5 0 00-6.364-6.364l-4.5 4.5a4.5 4.5 0 001.242 7.244" },
          ] as const
        ).map((tab) => {
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold transition-all duration-150 cursor-pointer shrink-0 ${
                isActive
                  ? "bg-zinc-800 text-zinc-100 font-semibold shadow-xs border border-zinc-700/50"
                  : "text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/60"
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
                <h2 className="text-sm font-bold text-zinc-900 dark:text-white">Appearance & Theme</h2>
                <p className="text-xs text-zinc-500 dark:text-zinc-400">Choose how My Manager looks across your device screens</p>
              </div>
            </div>

            <ThemeToggle variant="card" />
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
                <p className="text-xs text-zinc-500 dark:text-zinc-400">Global system configuration and platform metadata</p>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
              <div className="p-4 rounded-xl bg-slate-50 dark:bg-zinc-900/50 border border-zinc-200 dark:border-zinc-800">
                <span className="text-xs text-zinc-400">Application Name</span>
                <p className="text-sm font-semibold text-zinc-800 dark:text-zinc-200 mt-0.5">My Manager - Executive Hub</p>
              </div>
              <div className="p-4 rounded-xl bg-slate-50 dark:bg-zinc-900/50 border border-zinc-200 dark:border-zinc-800">
                <span className="text-xs text-zinc-400">Environment Mode</span>
                <p className="text-sm font-semibold text-emerald-600 dark:text-emerald-400 mt-0.5">Production Ready</p>
              </div>
              <div className="p-4 rounded-xl bg-slate-50 dark:bg-zinc-900/50 border border-zinc-200 dark:border-zinc-800">
                <span className="text-xs text-zinc-400">Timezone</span>
                <p className="text-sm font-semibold text-zinc-800 dark:text-zinc-200 mt-0.5">Asia/Kolkata (IST - UTC+05:30)</p>
              </div>
              <div className="p-4 rounded-xl bg-slate-50 dark:bg-zinc-900/50 border border-zinc-200 dark:border-zinc-800">
                <span className="text-xs text-zinc-400">Next.js Framework Version</span>
                <p className="text-sm font-semibold text-zinc-800 dark:text-zinc-200 mt-0.5">v15.2 (Turbopack Engine)</p>
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
                <div className="w-16 h-16 rounded-2xl bg-gradient-to-tr from-blue-600 to-indigo-600 border border-blue-500/30 flex items-center justify-center text-2xl font-extrabold text-white shrink-0 shadow-lg shadow-blue-500/20">
                  {(user?.name || "U").charAt(0).toUpperCase()}
                </div>
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
                      {assignedSections.length} {assignedSections.length === 1 ? "Section" : "Sections"}
                    </span>
                  </div>
                )}
                <span className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-600 dark:text-emerald-400 text-xs font-medium">
                  <span className="w-2 h-2 rounded-full bg-emerald-500 dark:bg-emerald-400" />
                  Active Account
                </span>
              </div>
            </div>
          </div>

          {/* Edit Profile Information */}
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
                <label className="text-xs text-zinc-500 dark:text-zinc-400 font-medium block mb-1.5">Email Address</label>
                <input
                  type="text"
                  value={user?.email || ""}
                  disabled
                  className="w-full bg-slate-50 dark:bg-zinc-800/40 border border-zinc-200 dark:border-zinc-800 rounded-xl px-4 py-2.5 text-xs text-zinc-500 dark:text-zinc-400 cursor-not-allowed font-mono"
                />
              </div>
              <div>
                <label className="text-xs text-zinc-500 dark:text-zinc-400 font-medium block mb-1.5">Full Name</label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  disabled={isAdmin}
                  placeholder="Your full name"
                  className="w-full bg-white dark:bg-[#111114] border border-zinc-300 dark:border-zinc-800 rounded-xl px-4 py-2.5 text-xs text-zinc-900 dark:text-zinc-200 placeholder:text-zinc-400 dark:placeholder:text-zinc-600 focus:outline-none focus:border-zinc-400 dark:focus:border-zinc-600 transition disabled:opacity-50 disabled:cursor-not-allowed shadow-xs"
                />
              </div>
              <div className="md:col-span-2">
                <label className="text-xs text-zinc-500 dark:text-zinc-400 font-medium block mb-1.5">Phone Number</label>
                <input
                  type="text"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  disabled={isAdmin}
                  placeholder="Phone number"
                  className="w-full bg-white dark:bg-[#111114] border border-zinc-300 dark:border-zinc-800 rounded-xl px-4 py-2.5 text-xs text-zinc-900 dark:text-zinc-200 placeholder:text-zinc-400 dark:placeholder:text-zinc-600 focus:outline-none focus:border-zinc-400 dark:focus:border-zinc-600 transition disabled:opacity-50 disabled:cursor-not-allowed shadow-xs"
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
        <div className="bg-white dark:bg-[#111114] border border-zinc-200 dark:border-zinc-800 rounded-2xl p-6 space-y-6 shadow-xs">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20 flex items-center justify-center">
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M14.857 17.082a23.848 23.848 0 005.454-1.31A8.967 8.967 0 0118 9.75v-.7V9A6 6 0 006 9v.75a8.967 8.967 0 01-2.312 6.022c1.733.64 3.56 1.085 5.455 1.31m5.714 0a24.255 24.255 0 01-5.714 0m5.714 0a3 3 0 11-5.714 0" />
              </svg>
            </div>
            <div>
              <h2 className="text-sm font-bold text-zinc-900 dark:text-white">Email & System Notifications</h2>
              <p className="text-xs text-zinc-500 dark:text-zinc-400">Configure what events send direct alerts to your administrative team</p>
            </div>
          </div>

          <div className="divide-y divide-zinc-100 dark:divide-zinc-800/60">
            <div className="py-3.5 flex items-center justify-between">
              <div>
                <p className="text-xs font-semibold text-zinc-900 dark:text-white">New Lead Submissions</p>
                <p className="text-xs text-zinc-400">Receive instant alerts when a high-intent client submits the lead intake form</p>
              </div>
              <button
                onClick={() => setNotifyLeads(!notifyLeads)}
                className={`w-11 h-6 rounded-full transition-colors relative cursor-pointer ${notifyLeads ? "bg-blue-600" : "bg-zinc-300 dark:bg-zinc-700"}`}
              >
                <div className={`w-4 h-4 rounded-full bg-white absolute top-1 transition-transform ${notifyLeads ? "left-6" : "left-1"}`} />
              </button>
            </div>

            <div className="py-3.5 flex items-center justify-between">
              <div>
                <p className="text-xs font-semibold text-zinc-900 dark:text-white">General Form Enquiries</p>
                <p className="text-xs text-zinc-400">Notify when visitors fill out Promise Me contact cards</p>
              </div>
              <button
                onClick={() => setNotifyForms(!notifyForms)}
                className={`w-11 h-6 rounded-full transition-colors relative cursor-pointer ${notifyForms ? "bg-blue-600" : "bg-zinc-300 dark:bg-zinc-700"}`}
              >
                <div className={`w-4 h-4 rounded-full bg-white absolute top-1 transition-transform ${notifyForms ? "left-6" : "left-1"}`} />
              </button>
            </div>

            <div className="py-3.5 flex items-center justify-between">
              <div>
                <p className="text-xs font-semibold text-zinc-900 dark:text-white">Security & Auth Alerts</p>
                <p className="text-xs text-zinc-400">Notify immediately on repeated failed logins or privilege escalation</p>
              </div>
              <button
                onClick={() => setNotifySecurity(!notifySecurity)}
                className={`w-11 h-6 rounded-full transition-colors relative cursor-pointer ${notifySecurity ? "bg-blue-600" : "bg-zinc-300 dark:bg-zinc-700"}`}
              >
                <div className={`w-4 h-4 rounded-full bg-white absolute top-1 transition-transform ${notifySecurity ? "left-6" : "left-1"}`} />
              </button>
            </div>

            <div className="py-3.5 flex items-center justify-between">
              <div>
                <p className="text-xs font-semibold text-zinc-900 dark:text-white">Weekly Executive Digest</p>
                <p className="text-xs text-zinc-400">Summary report of financial transactions, instagram growth, and new leads</p>
              </div>
              <button
                onClick={() => setWeeklyDigest(!weeklyDigest)}
                className={`w-11 h-6 rounded-full transition-colors relative cursor-pointer ${weeklyDigest ? "bg-blue-600" : "bg-zinc-300 dark:bg-zinc-700"}`}
              >
                <div className={`w-4 h-4 rounded-full bg-white absolute top-1 transition-transform ${weeklyDigest ? "left-6" : "left-1"}`} />
              </button>
            </div>
          </div>
        </div>
      )}

      {/* TAB: INTEGRATIONS */}
      {activeTab === "integrations" && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Google Drive BYO-Storage */}
          <div className="bg-white dark:bg-[#111114] border border-zinc-200 dark:border-zinc-800 rounded-2xl p-6 space-y-4 shadow-xs">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border border-indigo-500/20 flex items-center justify-center font-bold">
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M20.25 6.375c0 2.278-3.694 4.125-8.25 4.125S3.75 8.653 3.75 6.375m16.5 0c0-2.278-3.694-4.125-8.25-4.125S3.75 4.097 3.75 6.375m16.5 0v11.25c0 2.278-3.694 4.125-8.25 4.125s-8.25-1.847-8.25-4.125V6.375m16.5 5.625c0 2.278-3.694 4.125-8.25 4.125s-8.25-1.847-8.25-4.125" />
                  </svg>
                </div>
                <div>
                  <h3 className="text-sm font-bold text-zinc-900 dark:text-white">Google Drive BYO-Storage</h3>
                  <p className="text-xs text-zinc-400">Encrypted configs &amp; JSON backups</p>
                </div>
              </div>
              <span className="px-2.5 py-1 rounded-full text-[11px] font-semibold bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
                AES-256-GCM
              </span>
            </div>
            <p className="text-xs text-zinc-500 dark:text-zinc-400">
              Stores encrypted backups directly inside the <code className="text-indigo-400 bg-indigo-950/40 px-1 py-0.5 rounded">MyManager_AppData</code> folder on your Google Drive.
            </p>
          </div>

          {/* Google Sheets Live Sync */}
          <div className="bg-white dark:bg-[#111114] border border-zinc-200 dark:border-zinc-800 rounded-2xl p-6 space-y-4 shadow-xs">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 flex items-center justify-center font-bold">
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
                  </svg>
                </div>
                <div>
                  <h3 className="text-sm font-bold text-zinc-900 dark:text-white">Google Sheets Live Sync</h3>
                  <p className="text-xs text-zinc-400">2-Way continuous pipeline synchronization</p>
                </div>
              </div>
              <span className="px-2.5 py-1 rounded-full text-[11px] font-semibold bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
                Active
              </span>
            </div>
            <p className="text-xs text-zinc-500 dark:text-zinc-400">
              Synchronizes leads, status changes (New, Contacted, Converted) and rows with your connected spreadsheets.
            </p>
          </div>

          {/* Instagram Graph API */}
          <div className="bg-white dark:bg-[#111114] border border-zinc-200 dark:border-zinc-800 rounded-2xl p-6 space-y-4 shadow-xs">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-amber-500 via-rose-500 to-purple-600 flex items-center justify-center text-white font-bold shadow-md shadow-rose-500/20">
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <rect width="18" height="18" x="3" y="3" rx="5" />
                    <circle cx="12" cy="12" r="4" />
                    <circle cx="17.5" cy="6.5" r="1" fill="currentColor" />
                  </svg>
                </div>
                <div>
                  <h3 className="text-sm font-bold text-zinc-900 dark:text-white">Instagram Graph API</h3>
                  <p className="text-xs text-zinc-400">Manage posts, media upload &amp; schedule</p>
                </div>
              </div>
              <span className="px-2.5 py-1 rounded-full text-[11px] font-semibold bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
                Connected
              </span>
            </div>
            <p className="text-xs text-zinc-500 dark:text-zinc-400">
              Allows publishing photos, reels, carousel posts and reading account telemetry.
            </p>
          </div>
        </div>
      )}


    </div>
  );
}




