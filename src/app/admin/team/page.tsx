"use client";

import { useState, useEffect, useRef, useMemo } from "react";
import Link from "next/link";
import ConfirmModal from "@/components/ConfirmModal";
import {
  SECTIONS,
  SECTION_KEYS,
  SectionKey,
  hasReadPermission,
  hasWritePermission,
  notifyAuthPermissionsChanged,
} from "@/lib/permissions";

interface TeamMember {
  id: string;
  name: string;
  email: string;
  phone: string | null;
  role: string;
  permissions: string[];
  isActive: boolean;
  invitationToken?: string | null;
  createdAt: string;
  updatedAt: string;
}

const PERMISSION_CONFIG: Partial<Record<
  SectionKey,
  { label: string; description: string; icon: React.ReactNode }
>> = {
  leads: {
    label: "Leads",
    description: "Spreadsheet, custom sheets, folders, and lead records",
    icon: (
      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 6.75h12M8.25 12h12m-12 5.25h12M3.75 6.75h.007v.008H3.75V6.75zm.375 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zM3.75 12h.007v.008H3.75V12zm.375 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zm-.375 5.25h.007v.008H3.75v-.008zm.375 0a.375.375 0 11-.75 0 .375.375 0 01.75 0z" />
      </svg>

    ),
  },
  forms: {
    label: "Forms / Enquiries",
    description: "Website contact forms and builder enquiries",
    icon: (
      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M11.48 3.499a.562.562 0 011.04 0l2.125 5.111a.563.563 0 00.475.345l5.518.442c.499.04.701.663.321.988l-4.204 3.602a.563.563 0 00-.182.557l1.285 5.385a.562.562 0 01-.84.61l-4.725-2.885a.563.563 0 00-.586 0L6.982 20.54a.562.562 0 01-.84-.61l1.285-5.386a.562.562 0 00-.182-.557l-4.204-3.602a.563.563 0 01.321-.988l5.518-.442a.563.563 0 00.475-.345L11.48 3.5z" />
      </svg>
    ),
  },
  credentials: {
    label: "Password Manager",
    description: "Encrypted credentials, logins, and project access keys",
    icon: (
      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 10.5V6.75a4.5 4.5 0 10-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 002.25-2.25v-6.75a2.25 2.25 0 00-2.25-2.25H6.75a2.25 2.25 0 00-2.25 2.25v6.75a2.25 2.25 0 002.25 2.25z" />
      </svg>
    ),
  },
  finance: {
    label: "Finance / Payments",
    description: "Income, expenses, refunds, and financial summaries",
    icon: (
      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v12m-3-2.818l.879.659c1.171.879 3.07.879 4.242 0 1.172-.879 1.172-2.303 0-3.182C13.536 12.219 12.768 12 12 12c-.725 0-1.45-.22-2.003-.659-1.106-.879-1.106-2.303 0-3.182s2.9-.879 4.006 0l.415.33M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
    ),
  },
  calendar: {
    label: "Calendar & Meetings",
    description: "Google Calendar scheduling, free/busy slots, and Google Meet integration",
    icon: (
      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 012.25-2.25h13.5A2.25 2.25 0 0121 7.5v11.25m-18 0A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75m-18 0v-7.5A2.25 2.25 0 015.25 9h13.5A2.25 2.25 0 0121 9v7.5" />
      </svg>
    ),
  },
  env: {

    label: "Environment Variables",
    description: "Manage project environment variables and deployments",
    icon: (
      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M9.594 3.94c.09-.542.56-.94 1.11-.94h2.593c.55 0 1.02.398 1.11.94l.213 1.281c.063.374.313.686.645.87.074.04.147.083.22.127.325.196.72.257 1.075.124l1.217-.456a1.125 1.125 0 011.37.49l1.296 2.247a1.125 1.125 0 01-.26 1.431l-1.003.827c-.293.241-.438.613-.43.992a7.723 7.723 0 010 .255c-.008.378.137.53.43.991l1.004.827c.424.35.534.955.26 1.43l-1.298 2.247a1.125 1.125 0 01-1.369.491l-1.217-.456c-.355-.133-.75-.072-1.076.124a6.47 6.47 0 01-.22.128c-.331.183-.581.495-.644.869l-.213 1.281c-.09.543-.56.94-1.11.94h-2.594c-.55 0-1.019-.398-1.11-.94l-.213-1.281c-.062-.374-.312-.686-.644-.87a6.52 6.52 0 01-.22-.127c-.325-.196-.72-.257-1.076-.124l-1.217.456a1.125 1.125 0 01-1.369-.49l-1.297-2.247a1.125 1.125 0 01.26-1.431l1.004-.827c.292-.24.437-.613.43-.991a6.932 6.932 0 010-.255c.007-.38-.138-.751-.43-.992l-1.004-.827a1.125 1.125 0 01-.26-1.43l1.297-2.247a1.125 1.125 0 011.37-.491l1.216.456c.356.133.751.072 1.076-.124.072-.044.146-.086.22-.128.332-.183.582-.495.644-.869l.214-1.28z" />
        <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
      </svg>
    ),
  },
  team: {
    label: "Team",
    description: "Manage team members, roles, and section access",
    icon: (
      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M15 19.128a9.38 9.38 0 002.625.372 9.337 9.337 0 004.121-.952 4.125 4.125 0 00-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 018.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0111.964-3.07M12 6.375a3.375 3.375 0 11-6.75 0 3.375 3.375 0 016.75 0zm8.25 2.25a2.625 2.625 0 11-5.25 0 2.625 2.625 0 015.25 0z" />
      </svg>
    ),
  },
  activity_log: {
    label: "Activity Log",
    description: "Audit trail of admin and team actions across the system",
    icon: (
      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
    ),
  },
  instagram: {
    label: "Instagram",
    description: "Connect Instagram account, view and publish posts",
    icon: (
      <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5}>
        <rect x="2" y="2" width="20" height="20" rx="5" ry="5" />
        <path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z" />
        <line x1="17.5" y1="6.5" x2="17.51" y2="6.5" strokeWidth={2.5} strokeLinecap="round" />
      </svg>
    ),
  },
  settings: {
    label: "Settings",
    description: "Application configuration and account security",
    icon: (
      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M9.594 3.94c.09-.542.56-.94 1.11-.94h2.593c.55 0 1.02.398 1.11.94l.213 1.281c.063.374.313.686.645.87.074.04.147.083.22.127.325.196.72.257 1.075.124l1.217-.456a1.125 1.125 0 011.37.49l1.296 2.247a1.125 1.125 0 01-.26 1.431l-1.003.827c-.293.241-.438.613-.43.992a7.723 7.723 0 010 .255c-.008.378.137.53.43.991l1.004.827c.424.35.534.955.26 1.43l-1.298 2.247a1.125 1.125 0 01-1.369.491l-1.217-.456c-.355-.133-.75-.072-1.076.124a6.47 6.47 0 01-.22.128c-.331.183-.581.495-.644.869l-.213 1.281c-.09.543-.56.94-1.11.94h-2.594c-.55 0-1.019-.398-1.11-.94l-.213-1.281c-.062-.374-.312-.686-.644-.87a6.52 6.52 0 01-.22-.127c-.325-.196-.72-.257-1.076-.124l-1.217.456a1.125 1.125 0 01-1.369-.49l-1.297-2.247a1.125 1.125 0 01.26-1.431l1.004-.827c.292-.24.437-.613.43-.991a6.932 6.932 0 010-.255c.007-.38-.138-.751-.43-.992l-1.004-.827a1.125 1.125 0 01-.26-1.43l1.297-2.247a1.125 1.125 0 011.37-.491l1.216.456c.356.133.751.072 1.076-.124.072-.044.146-.086.22-.128.332-.183.582-.495.644-.869l.214-1.28z" />
        <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
      </svg>
    ),
  },
};

const ASSIGNABLE_SECTION_KEYS = SECTION_KEYS.filter((k) => k !== "dashboard");



type PermissionLevel = "none" | "read" | "write";

function getSectionLevel(permissions: string[], section: SectionKey): PermissionLevel {
  if (hasWritePermission(permissions, section)) return "write";
  if (hasReadPermission(permissions, section)) return "read";
  return "none";
}

function setSectionLevel(
  currentPerms: string[],
  section: SectionKey,
  level: PermissionLevel
): string[] {
  // Remove existing occurrences of this section
  const cleaned = currentPerms.filter(
    (p) => p !== section && p !== `${section}:read` && p !== `${section}:write`
  );

  if (level === "read") {
    return [...cleaned, `${section}:read`];
  }
  if (level === "write") {
    return [...cleaned, `${section}:read`, `${section}:write`];
  }
  return cleaned;
}

export default function TeamPage() {
  const [members, setMembers] = useState<TeamMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [filterRole, setFilterRole] = useState<"all" | "active" | "pending" | "admin">("all");
  const [toast, setToast] = useState<{ type: "success" | "error"; message: string } | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);

  // Edit Permissions Modal State
  const [selectedMember, setSelectedMember] = useState<TeamMember | null>(null);
  const [editingPermissions, setEditingPermissions] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);

  // Resend Invite State & Copy State
  const [resendingId, setResendingId] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  // Delete Confirm Modal State
  const [deletingMember, setDeletingMember] = useState<TeamMember | null>(null);
  const [deleteLoading, setDeleteLoading] = useState(false);

  const initialLoadDone = useRef(false);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 4000);
    return () => clearTimeout(t);
  }, [toast]);

  useEffect(() => {
    let cancelled = false;
    if (initialLoadDone.current) setLoading(true);
    fetch("/api/admin/team")
      .then((r) => r.json())
      .then((data) => {
        if (!cancelled) setMembers(data.members || []);
      })
      .catch(() => {
        if (!cancelled) setToast({ type: "error", message: "Failed to load team members" });
      })
      .finally(() => {
        if (!cancelled) {
          setLoading(false);
          initialLoadDone.current = true;
        }
      });
    return () => {
      cancelled = true;
    };
  }, [refreshKey]);

  // Filtered members
  const filteredMembers = useMemo(() => {
    return members.filter((m) => {
      const matchSearch =
        m.name.toLowerCase().includes(search.toLowerCase()) ||
        m.email.toLowerCase().includes(search.toLowerCase()) ||
        (m.phone && m.phone.includes(search));

      if (!matchSearch) return false;

      if (filterRole === "admin") return m.role === "admin";
      if (filterRole === "active") return m.role !== "admin" && m.isActive;
      if (filterRole === "pending") return m.role !== "admin" && !m.isActive;
      return true;
    });
  }, [members, search, filterRole]);

  // Statistics
  const stats = useMemo(() => {
    const total = members.length;
    const active = members.filter((m) => m.isActive && m.role !== "admin").length;
    const pending = members.filter((m) => !m.isActive && m.role !== "admin").length;
    const admins = members.filter((m) => m.role === "admin").length;
    return { total, active, pending, admins };
  }, [members]);

  const handleCopyInviteLink = (member: TeamMember) => {
    if (!member.invitationToken) {
      setToast({ type: "error", message: "Invitation token not available. Try resending invitation." });
      return;
    }
    const url = `${window.location.origin}/accept-invitation?token=${member.invitationToken}`;
    navigator.clipboard.writeText(url);
    setCopiedId(member.id);
    setToast({ type: "success", message: `Invitation link for ${member.name} copied to clipboard!` });
    setTimeout(() => setCopiedId(null), 2500);
  };

  async function handleResendInvitation(memberId: string) {
    setResendingId(memberId);
    try {
      const res = await fetch("/api/admin/team/resend-invitation", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId: memberId }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setToast({ type: "success", message: "Invitation email dispatched & link updated!" });
      setRefreshKey((k) => k + 1);
    } catch {
      setToast({ type: "error", message: "Failed to resend invitation" });
    } finally {
      setResendingId(null);
    }
  }

  async function handleConfirmDelete() {
    if (!deletingMember) return;
    setDeleteLoading(true);
    try {
      const res = await fetch(`/api/admin/team/${deletingMember.id}`, { method: "DELETE" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setToast({ type: "success", message: `Team member "${deletingMember.name}" removed` });
      setDeletingMember(null);
      setRefreshKey((k) => k + 1);
      notifyAuthPermissionsChanged();
    } catch {
      setToast({ type: "error", message: "Failed to remove team member" });
    } finally {
      setDeleteLoading(false);
    }
  }

  async function handleUpdatePermissions() {
    if (!selectedMember) return;
    setSaving(true);
    try {
      const res = await fetch(`/api/admin/team/${selectedMember.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ permissions: editingPermissions }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setToast({ type: "success", message: `Permissions updated for ${selectedMember.name}` });
      setSelectedMember(null);
      setRefreshKey((k) => k + 1);
      notifyAuthPermissionsChanged();
    } catch {
      setToast({ type: "error", message: "Failed to update permissions" });
    } finally {
      setSaving(false);
    }
  }

  function getAvatarColor(name: string) {
    const colors = [
      "from-blue-600 to-indigo-600",
      "from-emerald-600 to-teal-600",
      "from-purple-600 to-pink-600",
      "from-amber-600 to-orange-600",
      "from-rose-600 to-red-600",
      "from-cyan-600 to-blue-600",
    ];
    const index = (name.charCodeAt(0) || 0) % colors.length;
    return colors[index];
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
                <path strokeLinecap="round" strokeLinejoin="round" d="M15 19.128a9.38 9.38 0 002.625.372 9.337 9.337 0 004.121-.952 4.125 4.125 0 00-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 018.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0111.964-3.07M12 6.375a3.375 3.375 0 11-6.75 0 3.375 3.375 0 016.75 0zm8.25 2.25a2.625 2.625 0 11-5.25 0 2.625 2.625 0 015.25 0z" />
              </svg>
            </span>
            Team Members
          </h1>
          <p className="text-sm text-zinc-500 dark:text-zinc-400 mt-1">
            Manage your team accounts, role privileges, and granular Read / Write section permissions.
          </p>
        </div>

        <div className="flex items-center gap-2.5 shrink-0">
          <button
            onClick={() => setRefreshKey((k) => k + 1)}
            className="flex items-center gap-2 px-3.5 py-2 text-xs font-semibold text-zinc-700 dark:text-zinc-200 bg-white dark:bg-[#111114] hover:bg-zinc-100 dark:hover:bg-zinc-800 border border-zinc-200 dark:border-zinc-800 hover:border-zinc-300 dark:hover:border-zinc-700 rounded-xl transition-all duration-150 cursor-pointer shadow-xs active:scale-97"
            title="Refresh Members"
          >
            <svg className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0l3.181 3.183a8.25 8.25 0 0013.803-3.7M4.031 9.865a8.25 8.25 0 0113.803-3.7l3.181 3.182" />
            </svg>
            <span>Refresh</span>
          </button>

          <Link
            href="/admin/team/add"
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-xs font-bold transition-all duration-150 shadow-xs cursor-pointer active:scale-97 shrink-0"
          >
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
            </svg>
            Add Team Member
          </Link>
        </div>
      </div>

      {/* 2. Summary KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Total Members */}
        <div className="bg-white dark:bg-[#111114] border border-zinc-200 dark:border-zinc-800 rounded-2xl p-5 shadow-xs hover:border-zinc-300 dark:hover:border-zinc-700 transition-all">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider">Total Members</span>
            <span className="w-8 h-8 rounded-lg bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/20 flex items-center justify-center">
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M18 18.72a9.094 9.094 0 003.741-.479 3 3 0 00-4.682-2.72m.94 3.198l.001.031c0 .225-.012.447-.037.666A11.944 11.944 0 0112 21c-2.17 0-4.207-.576-5.963-1.584A6.062 6.062 0 016 18.719m12 0a5.971 5.971 0 00-.941-3.197m0 0A5.995 5.995 0 0012 12.75a5.995 5.995 0 00-5.058 2.772m0 0a3 3 0 00-4.681 2.72 8.986 8.986 0 003.74.477m.94-3.197a5.971 5.971 0 00-.94 3.197M15 6.75a3 3 0 11-6 0 3 3 0 016 0zm6 3a2.25 2.25 0 11-4.5 0 2.25 2.25 0 014.5 0zm-13.5 0a2.25 2.25 0 11-4.5 0 2.25 2.25 0 014.5 0z" />
              </svg>
            </span>
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-2xl font-bold tracking-tight text-zinc-900 dark:text-white">{stats.total}</span>
            <span className="text-xs text-zinc-400 font-medium">accounts</span>
          </div>
        </div>

        {/* Active Members */}
        <div className="bg-white dark:bg-[#111114] border border-zinc-200 dark:border-zinc-800 rounded-2xl p-5 shadow-xs hover:border-zinc-300 dark:hover:border-zinc-700 transition-all">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider">Active Members</span>
            <span className="w-8 h-8 rounded-lg bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 flex items-center justify-center">
              <div className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse" />
            </span>
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-2xl font-bold tracking-tight text-zinc-900 dark:text-white">{stats.active}</span>
            <span className="text-xs text-emerald-600 dark:text-emerald-400 font-medium">operational</span>
          </div>
        </div>

        {/* Pending Invites */}
        <div className="bg-white dark:bg-[#111114] border border-zinc-200 dark:border-zinc-800 rounded-2xl p-5 shadow-xs hover:border-zinc-300 dark:hover:border-zinc-700 transition-all">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider">Pending Invites</span>
            <span className="w-8 h-8 rounded-lg bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20 flex items-center justify-center">
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </span>
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-2xl font-bold tracking-tight text-zinc-900 dark:text-white">{stats.pending}</span>
            <span className="text-xs text-amber-600 dark:text-amber-400 font-medium">awaiting</span>
          </div>
        </div>

        {/* Admins */}
        <div className="bg-white dark:bg-[#111114] border border-zinc-200 dark:border-zinc-800 rounded-2xl p-5 shadow-xs hover:border-zinc-300 dark:hover:border-zinc-700 transition-all">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider">Admins</span>
            <span className="w-8 h-8 rounded-lg bg-purple-500/10 text-purple-600 dark:text-purple-400 border border-purple-500/20 flex items-center justify-center">
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75m-3-7.036A11.959 11.959 0 013.598 6 11.99 11.99 0 003 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285z" />
              </svg>
            </span>
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-2xl font-bold tracking-tight text-zinc-900 dark:text-white">{stats.admins}</span>
            <span className="text-xs text-purple-600 dark:text-purple-400 font-medium">full access</span>
          </div>
        </div>
      </div>

      {/* Search & Filter Bar */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <svg className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z" />
          </svg>
          <input
            type="text"
            placeholder="Search by name, email, or phone..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full bg-white dark:bg-[#111114] border border-zinc-200 dark:border-zinc-800 rounded-xl pl-10 pr-4 py-2.5 text-xs text-zinc-900 dark:text-zinc-200 placeholder:text-zinc-400 dark:placeholder:text-zinc-500 focus:outline-none focus:border-zinc-400 dark:focus:border-zinc-600 transition shadow-xs"
          />
        </div>

        <div className="flex items-center gap-1 bg-slate-100 dark:bg-[#111114] border border-zinc-200 dark:border-zinc-800 rounded-xl p-1 shrink-0 overflow-x-auto shadow-xs">
          {(
            [
              { key: "all", label: `All (${members.length})` },
              { key: "active", label: `Active (${stats.active})` },
              { key: "pending", label: `Pending (${stats.pending})` },
              { key: "admin", label: `Admins (${stats.admins})` },
            ] as const
          ).map((tab) => (
            <button
              key={tab.key}
              onClick={() => setFilterRole(tab.key)}
              className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-all duration-150 cursor-pointer shrink-0 ${
                filterRole === tab.key
                  ? "bg-zinc-800 text-zinc-100 font-semibold shadow-xs border border-zinc-700/50"
                  : "text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/40"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Team Table */}
      <div className="bg-white dark:bg-[#111114] border border-zinc-200 dark:border-zinc-800 rounded-2xl overflow-hidden shadow-xs">
        {loading ? (
          <div className="flex flex-col items-center justify-center py-24 gap-3">
            <div className="w-7 h-7 border-2 border-zinc-600 border-t-white rounded-full animate-spin" />
            <p className="text-xs text-zinc-500">Loading team members...</p>
          </div>
        ) : filteredMembers.length === 0 ? (
          <div className="text-center py-20 px-4">
            <div className="w-12 h-12 rounded-full bg-zinc-800/50 text-zinc-400 flex items-center justify-center mx-auto mb-3 border border-zinc-700/50">
              <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M15 19.128a9.38 9.38 0 002.625.372 9.337 9.337 0 004.121-.952 4.125 4.125 0 00-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 018.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0111.964-3.07M12 6.375a3.375 3.375 0 11-6.75 0 3.375 3.375 0 016.75 0zm8.25 2.25a2.625 2.625 0 11-5.25 0 2.625 2.625 0 015.25 0z" />
              </svg>
            </div>
            <p className="text-sm font-semibold text-zinc-200">No team members found</p>
            <p className="text-xs text-zinc-400 mt-1 max-w-sm mx-auto">
              {search ? "Try adjusting your search query or filter" : "Get started by adding your first team member"}
            </p>
            {!search && (
              <div className="mt-4">
                <Link
                  href="/admin/team/add"
                  className="inline-flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white h-9 px-4 rounded-lg font-medium text-sm transition-colors shadow-xs"
                >
                  <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
                  </svg>
                  Add Team Member
                </Link>
              </div>
            )}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-zinc-200 dark:border-zinc-800 bg-slate-50 dark:bg-[#18181b]/60">
                  <th className="px-6 py-3.5 text-[11px] font-semibold text-zinc-600 dark:text-zinc-400 uppercase tracking-wider">Member</th>
                  <th className="px-6 py-3.5 text-[11px] font-semibold text-zinc-600 dark:text-zinc-400 uppercase tracking-wider">Contact</th>
                  <th className="px-6 py-3.5 text-[11px] font-semibold text-zinc-600 dark:text-zinc-400 uppercase tracking-wider">Status</th>
                  <th className="px-6 py-3.5 text-[11px] font-semibold text-zinc-600 dark:text-zinc-400 uppercase tracking-wider">Assigned Permissions</th>
                  <th className="px-6 py-3.5 text-[11px] font-semibold text-zinc-600 dark:text-zinc-400 uppercase tracking-wider text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800/60">
                {filteredMembers.map((member) => {
                  const isAdmin = member.role === "admin";
                  const avatarGradient = getAvatarColor(member.name);
                  const isPending = !isAdmin && !member.isActive;

                  // Find distinct sections granted
                  const grantedSections = ASSIGNABLE_SECTION_KEYS.map((sec) => ({
                    key: sec,
                    level: getSectionLevel(member.permissions, sec),
                  })).filter((s) => s.level !== "none");

                  return (
                    <tr key={member.id} className="hover:bg-slate-50/80 dark:hover:bg-zinc-800/30 transition-colors group">
                      {/* Name & Avatar */}
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3">
                          <div
                            className={`w-9 h-9 rounded-xl bg-gradient-to-br ${avatarGradient} flex items-center justify-center text-xs font-bold text-white shadow-md shrink-0`}
                          >
                            {member.name.charAt(0).toUpperCase()}
                          </div>
                          <div>
                            <div className="font-semibold text-sm text-zinc-900 dark:text-white flex items-center gap-1.5">
                              <span>{member.name}</span>
                              {isAdmin && (
                                <span className="inline-flex items-center px-1.5 py-0.2 rounded text-[10px] font-bold bg-purple-100 dark:bg-purple-950/80 text-purple-700 dark:text-purple-300 border border-purple-200 dark:border-purple-800/60">
                                  ADMIN
                                </span>
                              )}
                            </div>
                            <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5">{member.email}</p>
                          </div>
                        </div>
                      </td>

                      {/* Phone */}
                      <td className="px-6 py-4">
                        <span className="text-xs text-zinc-700 dark:text-zinc-300 font-mono">
                          {member.phone || <span className="text-zinc-400 dark:text-zinc-600">—</span>}
                        </span>
                      </td>

                      {/* Status */}
                      <td className="px-6 py-4">
                        {isAdmin ? (
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-purple-50 dark:bg-purple-950/60 text-purple-700 dark:text-purple-300 border border-purple-200 dark:border-purple-800/60">
                            <svg className="w-3 h-3 text-purple-600 dark:text-purple-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                              <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75m-3-7.036A11.959 11.959 0 013.598 6 11.99 11.99 0 003 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285z" />
                            </svg>
                            Super Admin
                          </span>
                        ) : member.isActive ? (
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800/60">
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 dark:bg-emerald-400" />
                            Active
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-amber-50 dark:bg-amber-950/60 text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-800/60">
                            <span className="w-1.5 h-1.5 rounded-full bg-amber-500 dark:bg-amber-400" />
                            Invitation Pending
                          </span>
                        )}
                      </td>

                      {/* Permissions */}
                      <td className="px-6 py-4 max-w-sm">
                        {isAdmin ? (
                          <span className="inline-flex items-center gap-1 text-xs text-purple-700 dark:text-purple-300 font-medium bg-purple-50 dark:bg-purple-950/40 px-2.5 py-1 rounded-md border border-purple-200 dark:border-purple-900/50">
                            Full Unrestricted Access
                          </span>
                        ) : grantedSections.length === 0 ? (
                          <span className="text-xs text-zinc-400 dark:text-zinc-600 italic">No sections assigned</span>
                        ) : (
                          <div className="flex flex-wrap gap-1.5 items-center">
                            {grantedSections.slice(0, 3).map((item) => {
                              const config = PERMISSION_CONFIG[item.key];
                              const isWrite = item.level === "write";
                              return (
                                <span
                                  key={item.key}
                                  className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md text-[11px] font-medium border ${
                                    isWrite
                                      ? "bg-emerald-50 dark:bg-emerald-950/40 border-emerald-200 dark:border-emerald-800/60 text-emerald-700 dark:text-emerald-300"
                                      : "bg-blue-50 dark:bg-blue-950/40 border-blue-200 dark:border-blue-800/60 text-blue-700 dark:text-blue-300"
                                  }`}
                                >
                                  <span>{config?.label || item.key}</span>
                                  <span
                                    className={`text-[9px] px-1 py-0.2 rounded font-bold uppercase ${
                                      isWrite
                                        ? "bg-emerald-200/60 dark:bg-emerald-900/60 text-emerald-800 dark:text-emerald-200"
                                        : "bg-blue-200/60 dark:bg-blue-900/60 text-blue-800 dark:text-blue-200"
                                    }`}
                                  >
                                    {item.level}
                                  </span>
                                </span>
                              );
                            })}
                            {grantedSections.length > 3 && (
                              <span className="text-[11px] text-zinc-500 font-medium">
                                +{grantedSections.length - 3} more
                              </span>
                            )}
                          </div>
                        )}
                      </td>

                      {/* Actions */}
                      <td className="px-6 py-4 text-right">
                        <div className="flex items-center justify-end gap-1.5 flex-wrap">
                          {!isAdmin && (
                            <>
                              {/* Edit Permissions Button */}
                              <button
                                onClick={() => {
                                  setSelectedMember(member);
                                  setEditingPermissions(member.permissions);
                                }}
                                className="inline-flex items-center gap-1.5 text-xs font-medium text-zinc-700 dark:text-zinc-300 hover:text-zinc-900 dark:hover:text-white bg-slate-100 dark:bg-[#18181b] hover:bg-slate-200 dark:hover:bg-zinc-800 border border-zinc-200 dark:border-zinc-700/70 px-3 py-1.5 rounded-lg transition cursor-pointer shadow-sm"
                                title="Edit assigned permissions"
                              >
                                <svg className="w-3.5 h-3.5 text-zinc-500 dark:text-zinc-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                  <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 10.5V6.75a4.5 4.5 0 10-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 002.25-2.25v-6.75a2.25 2.25 0 00-2.25-2.25H6.75a2.25 2.25 0 00-2.25 2.25v6.75a2.25 2.25 0 002.25 2.25z" />
                                </svg>
                                <span>Edit Permissions</span>
                              </button>

                              {/* Copy Invite Link Button (For Manual Share) */}
                              {isPending && (
                                <button
                                  onClick={() => handleCopyInviteLink(member)}
                                  className="inline-flex items-center gap-1 text-xs font-medium text-zinc-700 dark:text-zinc-200 hover:text-zinc-900 dark:hover:text-white bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 dark:hover:bg-zinc-700 border border-zinc-200 dark:border-zinc-700 px-2.5 py-1.5 rounded-lg transition cursor-pointer shadow-xs active:scale-97"
                                  title="Copy invitation link to share manually"
                                >
                                  {copiedId === member.id ? (
                                    <>
                                      <svg className="w-3.5 h-3.5 text-emerald-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                                        <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                                      </svg>
                                      <span className="text-emerald-600 dark:text-emerald-400 font-bold">Copied!</span>
                                    </>
                                  ) : (
                                    <>
                                      <svg className="w-3.5 h-3.5 text-zinc-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                        <path strokeLinecap="round" strokeLinejoin="round" d="M13.19 8.688a4.5 4.5 0 011.242 7.244l-4.5 4.5a4.5 4.5 0 01-6.364-6.364l1.757-1.757m13.35-.622l1.757-1.757a4.5 4.5 0 00-6.364-6.364l-4.5 4.5a4.5 4.5 0 001.242 7.244" />
                                      </svg>
                                      <span>Copy Link</span>
                                    </>
                                  )}
                                </button>
                              )}

                              {/* Resend Invite Button */}
                              {isPending && (
                                <button
                                  onClick={() => handleResendInvitation(member.id)}
                                  disabled={resendingId === member.id}
                                  className="inline-flex items-center gap-1 text-xs font-medium text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 bg-blue-50 dark:bg-blue-950/40 hover:bg-blue-100 dark:hover:bg-blue-900/50 border border-blue-200 dark:border-blue-800/60 px-2.5 py-1.5 rounded-lg transition cursor-pointer disabled:opacity-50"
                                  title="Resend invitation link via email"
                                >
                                  <svg className={`w-3.5 h-3.5 ${resendingId === member.id ? "animate-spin" : ""}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M6 12L3.269 3.126A59.768 59.768 0 0121.485 12 59.77 59.77 0 013.27 20.876L5.999 12zm0 0h7.5" />
                                  </svg>
                                  <span>{resendingId === member.id ? "Sending..." : "Resend Email"}</span>
                                </button>
                              )}

                              {/* Remove Button */}
                              <button
                                onClick={() => setDeletingMember(member)}
                                className="inline-flex items-center justify-center p-1.5 text-zinc-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-950/40 border border-transparent hover:border-red-200 dark:hover:border-red-900/50 rounded-lg transition cursor-pointer"
                                title="Remove team member"
                              >
                                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
                                  <path strokeLinecap="round" strokeLinejoin="round" d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0" />
                                </svg>
                              </button>
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>      {/* Ultra-Clear & Intuitive Edit Permissions Modal */}
      {selectedMember && (() => {
        const writeCount = ASSIGNABLE_SECTION_KEYS.filter(
          (sec) => getSectionLevel(editingPermissions, sec) === "write"
        ).length;
        const readCount = ASSIGNABLE_SECTION_KEYS.filter(
          (sec) => getSectionLevel(editingPermissions, sec) === "read"
        ).length;
        const noneCount = ASSIGNABLE_SECTION_KEYS.length - writeCount - readCount;

        return (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 animate-in fade-in duration-150 p-4 sm:p-6">
            <div className="fixed inset-0" onClick={() => !saving && setSelectedMember(null)} />
            <div className="relative bg-white dark:bg-[#111114] border border-zinc-200 dark:border-zinc-700/80 rounded-2xl w-full max-w-5xl mx-auto shadow-2xl z-10 animate-in zoom-in-95 duration-150 flex flex-col max-h-[95vh] overflow-hidden">
              {/* Modal Header */}
              <div className="flex items-center justify-between px-6 py-4 border-b border-zinc-200 dark:border-zinc-800 shrink-0 bg-slate-50 dark:bg-zinc-900/50">
                <div className="flex items-center gap-3.5">
                  <div
                    className={`w-11 h-11 rounded-xl bg-gradient-to-br ${getAvatarColor(selectedMember.name)} flex items-center justify-center text-base font-bold text-white shadow-md shrink-0`}
                  >
                    {selectedMember.name.charAt(0).toUpperCase()}
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <h2 className="text-lg font-bold text-zinc-900 dark:text-white leading-tight">Member Permissions & Access Control</h2>
                      <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-slate-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 border border-zinc-200 dark:border-zinc-700">
                        {selectedMember.role}
                      </span>
                    </div>
                    <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5">
                      Configuring access for <span className="text-zinc-900 dark:text-white font-medium">{selectedMember.name}</span> ({selectedMember.email})
                    </p>
                  </div>
                </div>

                <button
                  onClick={() => setSelectedMember(null)}
                  disabled={saving}
                  className="text-zinc-400 hover:text-zinc-700 dark:hover:text-white transition w-9 h-9 flex items-center justify-center rounded-xl hover:bg-slate-100 dark:hover:bg-zinc-800 cursor-pointer"
                >
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>

              {/* Quick Presets & Live Summary Bar */}
              <div className="px-6 py-3 bg-slate-50 dark:bg-[#16161a] border-b border-zinc-200 dark:border-zinc-800/80 flex flex-col md:flex-row md:items-center justify-between gap-3 text-xs shrink-0">
                {/* Live Stats */}
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-zinc-600 dark:text-zinc-400 font-medium">Current Access:</span>
                  <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-semibold bg-emerald-50 dark:bg-emerald-950/70 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800/60 shadow-2xs">
                    <span className="w-2 h-2 rounded-full bg-emerald-500 dark:bg-emerald-400" />
                    {writeCount} Full Control
                  </span>
                  <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-semibold bg-blue-50 dark:bg-blue-950/70 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-800/60 shadow-2xs">
                    <span className="w-2 h-2 rounded-full bg-blue-500 dark:bg-blue-400" />
                    {readCount} View Only
                  </span>
                  {noneCount > 0 && (
                    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-semibold bg-slate-200/80 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-400 border border-zinc-300 dark:border-zinc-700/60 shadow-2xs">
                      <span className="w-2 h-2 rounded-full bg-zinc-500" />
                      {noneCount} No Access
                    </span>
                  )}
                </div>

                {/* Quick 1-Click Presets */}
                <div className="flex items-center gap-2 flex-wrap">
                  <button
                    type="button"
                    onClick={() => {
                      const allWrite = ASSIGNABLE_SECTION_KEYS.flatMap((sec) => [
                        `${sec}:read`,
                        `${sec}:write`,
                      ]);
                      setEditingPermissions(allWrite);
                    }}
                    className="px-3 py-1.5 text-xs font-medium text-emerald-700 dark:text-emerald-300 hover:text-emerald-900 dark:hover:text-white bg-emerald-50 dark:bg-emerald-950/50 hover:bg-emerald-100 dark:hover:bg-emerald-900/60 border border-emerald-200 dark:border-emerald-800/60 rounded-xl transition cursor-pointer flex items-center gap-1.5 shadow-2xs"
                  >
                    <span>⚡ All Full Access</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      const allRead = ASSIGNABLE_SECTION_KEYS.map((sec) => `${sec}:read`);
                      setEditingPermissions(allRead);
                    }}
                    className="px-3 py-1.5 text-xs font-medium text-blue-700 dark:text-blue-300 hover:text-blue-900 dark:hover:text-white bg-blue-50 dark:bg-blue-950/50 hover:bg-blue-100 dark:hover:bg-blue-900/60 border border-blue-200 dark:border-blue-800/60 rounded-xl transition cursor-pointer flex items-center gap-1.5 shadow-2xs"
                  >
                    <span>👁️ All View Only</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setEditingPermissions([])}
                    className="px-3 py-1.5 text-xs font-medium text-zinc-700 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-200 bg-slate-200/80 dark:bg-zinc-800/60 hover:bg-slate-300 dark:hover:bg-zinc-700 border border-zinc-300 dark:border-zinc-700/50 rounded-xl transition cursor-pointer shadow-2xs"
                  >
                    🚫 Clear All
                  </button>
                </div>
              </div>

              {/* Spacious 2-Column Permissions Grid */}
              <div className="px-6 py-5 overflow-y-auto flex-1">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
                  {ASSIGNABLE_SECTION_KEYS.map((sec) => {
                    const config = PERMISSION_CONFIG[sec];
                    if (!config) return null;
                    const currentLevel = getSectionLevel(editingPermissions, sec);

                    return (
                      <div
                        key={sec}
                        className={`p-4 rounded-xl border transition-all flex flex-col justify-between gap-3 ${
                          currentLevel === "write"
                            ? "bg-emerald-50/50 dark:bg-emerald-950/15 border-emerald-300 dark:border-emerald-700/50 shadow-2xs"
                            : currentLevel === "read"
                            ? "bg-blue-50/50 dark:bg-blue-950/15 border-blue-300 dark:border-blue-700/50 shadow-2xs"
                            : "bg-slate-50 dark:bg-[#16161a] border-zinc-200 dark:border-zinc-800 hover:border-zinc-300 dark:hover:border-zinc-700 shadow-2xs"
                        }`}
                      >
                        {/* Section Details */}
                        <div className="flex items-start gap-3">
                          <div
                            className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 mt-0.5 ${
                              currentLevel === "write"
                                ? "bg-emerald-100 dark:bg-emerald-500/15 border border-emerald-200 dark:border-emerald-500/30 text-emerald-600 dark:text-emerald-400"
                                : currentLevel === "read"
                                ? "bg-blue-100 dark:bg-blue-500/15 border border-blue-200 dark:border-blue-500/30 text-blue-600 dark:text-blue-400"
                                : "bg-slate-200/80 dark:bg-zinc-800 border border-zinc-300 dark:border-zinc-700/60 text-zinc-600 dark:text-zinc-400"
                            }`}
                          >
                            {config.icon}
                          </div>
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center justify-between gap-2">
                              <span className="text-sm font-semibold text-zinc-900 dark:text-white">
                                {config.label}
                              </span>
                              {currentLevel === "write" && (
                                <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider bg-emerald-100 dark:bg-emerald-950 text-emerald-800 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-800/80">
                                  Full Control
                                </span>
                              )}
                              {currentLevel === "read" && (
                                <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider bg-blue-100 dark:bg-blue-950 text-blue-800 dark:text-blue-300 border border-blue-300 dark:border-blue-800/80">
                                  View Only
                                </span>
                              )}
                              {currentLevel === "none" && (
                                <span className="px-2 py-0.5 rounded text-[10px] font-semibold text-zinc-600 dark:text-zinc-500 bg-slate-200/80 dark:bg-zinc-800/80 border border-zinc-300 dark:border-zinc-700/50">
                                  No Access
                                </span>
                              )}
                            </div>
                            <p className="text-xs text-zinc-600 dark:text-zinc-400 mt-1 leading-snug line-clamp-2">
                              {config.description}
                            </p>
                          </div>
                        </div>

                        {/* 3-Choice Segmented Bar */}
                        <div className="grid grid-cols-3 gap-1 p-1 bg-slate-100 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800/90 rounded-xl mt-1">
                          <button
                            type="button"
                            onClick={() => setEditingPermissions(setSectionLevel(editingPermissions, sec, "none"))}
                            className={`py-1.5 text-xs font-medium rounded-lg transition cursor-pointer text-center ${
                              currentLevel === "none"
                                ? "bg-slate-300 dark:bg-zinc-700 text-zinc-900 dark:text-white font-semibold shadow-2xs"
                                : "text-zinc-500 dark:text-zinc-400 hover:text-zinc-800 dark:hover:text-zinc-200"
                            }`}
                          >
                            No Access
                          </button>
                          <button
                            type="button"
                            onClick={() => setEditingPermissions(setSectionLevel(editingPermissions, sec, "read"))}
                            className={`py-1.5 text-xs font-medium rounded-lg transition cursor-pointer flex items-center justify-center gap-1.5 ${
                              currentLevel === "read"
                                ? "bg-blue-600 text-white font-semibold shadow-2xs"
                                : "text-zinc-500 dark:text-zinc-400 hover:text-blue-600 dark:hover:text-blue-300 hover:bg-slate-200/50 dark:hover:bg-zinc-900"
                            }`}
                          >
                            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                              <path strokeLinecap="round" strokeLinejoin="round" d="M2.036 12.322a1.012 1.012 0 010-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178z" />
                              <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                            </svg>
                            <span>View</span>
                          </button>
                          <button
                            type="button"
                            onClick={() => setEditingPermissions(setSectionLevel(editingPermissions, sec, "write"))}
                            className={`py-1.5 text-xs font-medium rounded-lg transition cursor-pointer flex items-center justify-center gap-1.5 ${
                              currentLevel === "write"
                                ? "bg-emerald-600 text-white font-semibold shadow-2xs"
                                : "text-zinc-500 dark:text-zinc-400 hover:text-emerald-600 dark:hover:text-emerald-300 hover:bg-slate-200/50 dark:hover:bg-zinc-900"
                            }`}
                          >
                            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                              <path strokeLinecap="round" strokeLinejoin="round" d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L6.832 19.82a4.5 4.5 0 01-1.897 1.13l-2.685.8.8-2.685a4.5 4.5 0 011.13-1.897L16.863 4.487zm0 0L19.5 7.125" />
                            </svg>
                            <span>Full Control</span>
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Modal Footer */}
              <div className="flex items-center justify-between px-6 py-4 border-t border-zinc-200 dark:border-zinc-800 shrink-0 bg-slate-50 dark:bg-[#16161a] rounded-b-2xl">
                <span className="text-xs text-zinc-500 dark:text-zinc-400">
                  Read-only members can browse data without editing/deleting rights.
                </span>

                <div className="flex items-center gap-2.5">
                  <button
                    type="button"
                    onClick={() => setSelectedMember(null)}
                    disabled={saving}
                    className="px-4 py-2 text-xs font-medium text-zinc-700 dark:text-zinc-300 hover:text-zinc-900 dark:hover:text-white bg-slate-200/80 dark:bg-zinc-800 hover:bg-slate-300 dark:hover:bg-zinc-700 rounded-xl transition cursor-pointer shadow-2xs"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={handleUpdatePermissions}
                    disabled={saving}
                    className="flex items-center gap-2 px-6 py-2.5 text-xs font-bold text-white bg-blue-600 hover:bg-blue-500 disabled:opacity-50 disabled:cursor-not-allowed rounded-xl transition cursor-pointer shadow-sm"
                  >
                    {saving && <div className="w-3.5 h-3.5 border-2 border-white/40 border-t-white rounded-full animate-spin" />}
                    <span>{saving ? "Saving Changes..." : "Save Permissions"}</span>
                  </button>
                </div>
              </div>
            </div>
          </div>
        );
      })()}

      {/* Custom Site Confirm Delete Modal */}
      <ConfirmModal
        isOpen={Boolean(deletingMember)}
        title="Remove Team Member"
        message={
          deletingMember
            ? `Are you sure you want to remove "${deletingMember.name}" (${deletingMember.email}) from the team? They will immediately lose access to the system.`
            : ""
        }
        confirmText="Remove Member"
        confirmVariant="danger"
        isLoading={deleteLoading}
        onConfirm={handleConfirmDelete}
        onClose={() => setDeletingMember(null)}
      />
    </div>
  );
}
