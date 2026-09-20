"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState, useCallback, useRef, Suspense } from "react";
import { hasReadPermission } from "@/lib/permissions";
import ThemeToggle from "@/components/ThemeToggle";
import NotificationBell from "@/components/NotificationBell";

interface UserInfo {
  id: string;
  name: string;
  email: string;
  role: string;
  permissions: string[];
  image?: string | null;
}

interface NavItem {
  label: string;
  href: string;
  permission: string;
  icon: React.ReactNode;
}

interface NavGroup {
  category: string;
  items: NavItem[];
}

const navGroups: NavGroup[] = [
  {
    category: "MAIN / WORKSPACE",
    items: [
      {
        label: "Dashboard",
        href: "/admin",
        permission: "dashboard",
        icon: (
          <svg className="w-4 h-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6A2.25 2.25 0 016 3.75h2.25A2.25 2.25 0 0110.5 6v2.25a2.25 2.25 0 01-2.25 2.25H6a2.25 2.25 0 01-2.25-2.25V6zM3.75 15.75A2.25 2.25 0 016 13.5h2.25a2.25 2.25 0 012.25 2.25V18a2.25 2.25 0 01-2.25 2.25H6A2.25 2.25 0 013.75 18v-2.25zM13.5 6a2.25 2.25 0 012.25-2.25H18A2.25 2.25 0 0120.25 6v2.25A2.25 2.25 0 0118 10.5h-2.25a2.25 2.25 0 01-2.25-2.25V6zM13.5 15.75a2.25 2.25 0 012.25-2.25H18a2.25 2.25 0 012.25 2.25V18A2.25 2.25 0 0118 20.25h-2.25A2.25 2.25 0 0113.5 18v-2.25z" />
          </svg>
        ),
      },
      {
        label: "Tasks",
        href: "/admin/tasks",
        permission: "tasks",
        icon: (
          <svg className="w-4 h-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        ),
      },
      {
        label: "Spreadsheets",
        href: "/admin/leads",
        permission: "leads",
        icon: (
          <svg className="w-4 h-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 12h16.5m-16.5 3.75h16.5M3.75 19.5h16.5M5.625 4.5h12.75a1.875 1.875 0 010 3.75H5.625a1.875 1.875 0 010-3.75z" />
          </svg>
        ),
      },
      {
        label: "Form Submissions",
        href: "/admin/promise-me",
        permission: "forms",
        icon: (
          <svg className="w-4 h-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
          </svg>
        ),
      },
      {
        label: "Finance",
        href: "/admin/payments",
        permission: "finance",
        icon: (
          <svg className="w-4 h-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v12m-3-2.818l.879.659c1.171.879 3.07.879 4.242 0 1.172-.879 1.172-2.303 0-3.182C13.536 12.219 12.768 12 12 12c-.725 0-1.45-.22-2.003-.659-1.106-.879-1.106-2.303 0-3.182s2.9-.879 4.006 0l.415.33M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        ),
      },
    ],
  },
  {
    category: "OPERATIONS & TOOLS",
    items: [
      {
        label: "Calendar",
        href: "/admin/calendar",
        permission: "calendar",
        icon: (
          <svg className="w-4 h-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 012.25-2.25h13.5A2.25 2.25 0 0121 7.5v11.25m-18 0A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75m-18 0v-7.5A2.25 2.25 0 015.25 9h13.5A2.25 2.25 0 0121 9v7.5" />
          </svg>
        ),
      },
      {
        label: "Team",
        href: "/admin/team",
        permission: "team",
        icon: (
          <svg className="w-4 h-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 19.128a9.38 9.38 0 002.625.372 9.337 9.337 0 004.121-.952 4.125 4.125 0 00-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 018.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0111.964-3.07M12 6.375a3.375 3.375 0 11-6.75 0 3.375 3.375 0 016.75 0zm8.25 2.25a2.625 2.625 0 11-5.25 0 2.625 2.625 0 015.25 0z" />
          </svg>
        ),
      },
      {
        label: "FormBridge",
        href: "/admin/forms",
        permission: "forms",
        icon: (
          <svg className="w-4 h-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M13.19 8.688a4.5 4.5 0 011.242 7.244l-4.5 4.5a4.5 4.5 0 01-6.364-6.364l1.757-1.757m9.86-4.257a4.5 4.5 0 00-6.364-6.364L4.5 7.5l4.5 4.5-1.757 1.757a4.5 4.5 0 006.364 6.364l4.5-4.5a4.5 4.5 0 00-.324-.693z" />
          </svg>
        ),
      },
      {
        label: "Instagram",
        href: "/admin/instagram",
        permission: "instagram",
        icon: (
          <svg className="w-4 h-4 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75}>
            <rect x="2" y="2" width="20" height="20" rx="5" ry="5" />
            <path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z" />
            <line x1="17.5" y1="6.5" x2="17.51" y2="6.5" strokeWidth={2.5} strokeLinecap="round" />
          </svg>
        ),
      },
    ],
  },

  {
    category: "SECURITY & DEVELOPER",
    items: [
      {
        label: "Password Manager",
        href: "/admin/credentials",
        permission: "credentials",
        icon: (
          <svg className="w-4 h-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 10.5V6.75a4.5 4.5 0 10-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 002.25-2.25v-6.75a2.25 2.25 0 00-2.25-2.25H6.75a2.25 2.25 0 00-2.25 2.25v6.75a2.25 2.25 0 002.25 2.25z" />
          </svg>
        ),
      },
      {
        label: "Environment Variables",
        href: "/admin/env",
        permission: "env",
        icon: (
          <svg className="w-4 h-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M17.25 6.75L22.5 12l-5.25 5.25m-10.5 0L1.5 12l5.25-5.25m7.5-3l-4.5 16.5" />
          </svg>
        ),
      },
    ],
  },
  {
    category: "SYSTEM",
    items: [
      {
        label: "Activity Log",
        href: "/admin/activity-log",
        permission: "activity_log",
        icon: (
          <svg className="w-4 h-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        ),
      },
      {
        label: "Backup & Restore",
        href: "/admin/backup",
        permission: "settings",
        icon: (
          <svg className="w-4 h-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M20.25 6.375c0 2.278-3.694 4.125-8.25 4.125S3.75 8.653 3.75 6.375m16.5 0c0-2.278-3.694-4.125-8.25-4.125S3.75 4.097 3.75 6.375m16.5 0v11.25c0 2.278-3.694 4.125-8.25 4.125s-8.25-1.847-8.25-4.125V6.375m16.5 0v3.75m-16.5-3.75v3.75m16.5 0v3.75C20.25 16.153 16.556 18 12 18s-8.25-1.847-8.25-4.125v-3.75m16.5 0c0 2.278-3.694 4.125-8.25 4.125s-8.25-1.847-8.25-4.125" />
          </svg>
        ),
      },
      {
        label: "Settings",
        href: "/admin/settings",
        permission: "settings",
        icon: (
          <svg className="w-4 h-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M9.594 3.94c.09-.542.56-.94 1.11-.94h2.593c.55 0 1.02.398 1.11.94l.213 1.281c.063.374.313.686.645.87.074.04.147.083.22.127.325.196.72.257 1.075.124l1.217-.456a1.125 1.125 0 011.37.49l1.296 2.247a1.125 1.125 0 01-.26 1.431l-1.003.827c-.293.241-.438.613-.43.992a7.723 7.723 0 010 .255c-.008.378.137.53.43.991l1.004.827c.424.35.534.955.26 1.43l-1.298 2.247a1.125 1.125 0 01-1.369.491l-1.217-.456c-.355-.133-.75-.072-1.076.124a6.47 6.47 0 01-.22.128c-.331.183-.581.495-.644.869l-.213 1.281c-.09.543-.56.94-1.11.94h-2.594c-.55 0-1.019-.398-1.11-.94l-.213-1.281c-.062-.374-.312-.686-.644-.87a6.52 6.52 0 01-.22-.127c-.325-.196-.72-.257-1.076-.124l-1.217.456a1.125 1.125 0 01-1.369-.49l-1.297-2.247a1.125 1.125 0 01.26-1.431l1.004-.827c.292-.24.437-.613.43-.991a6.932 6.932 0 010-.255c.007-.38-.138-.751-.43-.992l-1.004-.827a1.125 1.125 0 01-.26-1.43l1.297-2.247a1.125 1.125 0 011.37-.491l1.216.456c.356.133.751.072 1.076-.124.072-.044.146-.086.22-.128.332-.183.582-.495.644-.869l.214-1.28z" />
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
          </svg>
        ),
      },
    ],
  },
];

const allNavItems = navGroups.flatMap((g) => g.items);

const SIDEBAR_MIN = 224;
const SIDEBAR_MAX = 360;

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <Suspense
      fallback={
        <div className="flex h-screen bg-[#09090b]">
          <aside className="w-60 border-r border-[#27272a] bg-[#09090b] flex items-center justify-center">
            <div className="w-5 h-5 border-2 border-zinc-600 border-t-zinc-300 rounded-full animate-spin" />
          </aside>
          <main className="flex-1 min-h-0 flex flex-col overflow-y-auto admin-scroll">{children}</main>
        </div>
      }
    >
      <AdminLayoutInner>{children}</AdminLayoutInner>
    </Suspense>
  );
}

interface WorkspaceOption {
  id: string;
  name: string;
  email: string;
  role: string;
  isCurrent: boolean;
}

function AdminLayoutInner({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const [user, setUser] = useState<UserInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [permissionToast, setPermissionToast] = useState<string | null>(null);
  const prevPermissionsRef = useRef<string[]>([]);
  const [workspaces, setWorkspaces] = useState<WorkspaceOption[]>([]);
  const [showWorkspaceDropdown, setShowWorkspaceDropdown] = useState(false);
  const [switchingWorkspace, setSwitchingWorkspace] = useState(false);

  // Sidebar width (resizable)
  const [sidebarWidth, setSidebarWidth] = useState(260);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const isResizing = useRef(false);
  const sidebarRef = useRef<HTMLElement>(null);
  const mainRef = useRef<HTMLElement | null>(null);

  // Handle route change: scroll to top immediately & close mobile drawer
  useEffect(() => {
    if (mainRef.current) {
      mainRef.current.scrollTop = 0;
    }
    setMobileMenuOpen(false);
  }, [pathname]);

  const fetchWorkspaces = useCallback(async () => {
    try {
      const res = await fetch("/api/admin/auth/workspaces");
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data.workspaces)) {
          setWorkspaces(data.workspaces);
        }
      }
    } catch {}
  }, []);

  const handleSwitchWorkspace = async (workspaceId: string) => {
    if (switchingWorkspace) return;
    setSwitchingWorkspace(true);
    try {
      const res = await fetch("/api/admin/auth/workspaces", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ workspaceId }),
      });
      if (res.ok) {
        window.location.href = "/admin";
        return;
      }
    } catch {}
    finally {
      setSwitchingWorkspace(false);
      setShowWorkspaceDropdown(false);
    }
  };

  const fetchUser = useCallback(async () => {
    try {
      const res = await fetch("/api/admin/auth/me");
      if (!res.ok) {
        router.push(`/?from=${encodeURIComponent(pathname)}`);
        return;
      }
      const data = await res.json();
      if (!data.authenticated || !data.user) {
        router.push(`/?from=${encodeURIComponent(pathname)}`);
        return;
      }
      setUser(data.user);
      fetchWorkspaces();
    } catch {
      router.push(`/?from=${encodeURIComponent(pathname)}`);
    } finally {
      setLoading(false);
    }
  }, [pathname, router, fetchWorkspaces]);

  useEffect(() => {
    fetchUser();
  }, [fetchUser]);

  // Permission polling — detect when admin removes/changes permissions
  useEffect(() => {
    if (!user || user.role === "admin") return;

    // Store initial permissions
    prevPermissionsRef.current = [...(user.permissions || [])];

    const pollPermissions = async () => {
      try {
        const res = await fetch("/api/admin/auth/me");
        if (!res.ok) return;
        const data = await res.json();
        if (!data.authenticated || !data.user) return;

        const newPerms = data.user.permissions || [];
        const oldPerms = prevPermissionsRef.current;

        // Check if any permissions were removed
        const removedPerms = oldPerms.filter((p: string) => !newPerms.includes(p));
        // Check if any permissions were added
        const addedPerms = newPerms.filter((p: string) => !oldPerms.includes(p));

        if (removedPerms.length > 0) {
          const SECTION_LABELS: Record<string, string> = {
            leads: "Spreadsheets", forms: "Forms", credentials: "Credentials",
            finance: "Finance", calendar: "Calendar", env: "Environment",
            team: "Team", activity_log: "Activity Log", instagram: "Instagram",
            settings: "Settings", dashboard: "Dashboard",
          };
          const removed = removedPerms.map((p: string) => {
            const section = p.split(":")[0];
            const access = p.includes(":write") ? "write" : "read";
            return `${SECTION_LABELS[section] || section} (${access})`;
          }).join(", ");
          setPermissionToast(`⚠️ Permissions removed: ${removed}`);
          setTimeout(() => setPermissionToast(null), 8000);
        } else if (addedPerms.length > 0) {
          setPermissionToast("✅ New permissions have been added to your account");
          setTimeout(() => setPermissionToast(null), 5000);
        }

        prevPermissionsRef.current = [...newPerms];
        setUser(data.user);
      } catch {}
    };

    const interval = setInterval(pollPermissions, 30000); // Poll every 30 seconds
    return () => clearInterval(interval);
  }, [user?.role, user?.id]);

  // Handle resizing
  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    isResizing.current = true;
    document.body.style.cursor = "col-resize";
    document.body.style.userSelect = "none";

    const handleMouseMove = (e: MouseEvent) => {
      if (!isResizing.current) return;
      const newWidth = Math.min(SIDEBAR_MAX, Math.max(SIDEBAR_MIN, e.clientX));
      setSidebarWidth(newWidth);
    };

    const handleMouseUp = () => {
      isResizing.current = false;
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseup", handleMouseUp);
    };

    window.addEventListener("mousemove", handleMouseMove);
    window.addEventListener("mouseup", handleMouseUp);
  }, []);

  async function handleLogout() {
    await fetch("/api/admin/auth/logout", { method: "POST" });
    router.push("/");
  }

  // Filter groups and items based on permissions
  const visibleNavGroups = navGroups
    .map((group) => ({
      ...group,
      items: group.items.filter((item) => {
        if (!user) return false;
        if (user.role === "admin") return true;
        return hasReadPermission(user.permissions, item.permission);
      }),
    }))
    .filter((group) => group.items.length > 0);

  const flatVisibleItems = visibleNavGroups.flatMap((g) => g.items);

  const currentSection = allNavItems.find((item) =>
    item.href === "/admin"
      ? pathname === "/admin"
      : pathname === item.href || pathname.startsWith(item.href + "/")
  );

  const isAuthorized =
    loading ||
    !user ||
    user.role === "admin" ||
    pathname === "/admin/settings" ||
    !currentSection ||
    hasReadPermission(user.permissions, currentSection.permission);

  const userInitial = ((user?.name || user?.email || "M").trim().charAt(0) || "M").toUpperCase();
  const userDisplayName = user?.name || user?.email?.split("@")[0] || "Admin";

  return (
    <div className="flex h-screen bg-slate-50 dark:bg-[#09090b] text-zinc-900 dark:text-zinc-100 overflow-hidden">
      {/* Mobile Drawer Backdrop */}
      {mobileMenuOpen && (
        <div
          onClick={() => setMobileMenuOpen(false)}
          className="fixed inset-0 bg-black/70 backdrop-blur-xs z-40 md:hidden transition-opacity"
        />
      )}

      {/* Sidebar (Fixed on desktop, Slide-over Drawer on mobile) */}
      <aside
        ref={sidebarRef}
        className={`fixed inset-y-0 left-0 z-50 md:static md:translate-x-0 transform transition-transform duration-200 ease-in-out border-r border-zinc-200 dark:border-[#27272a] bg-white dark:bg-[#09090b] flex flex-col shrink-0 ${
          mobileMenuOpen ? "translate-x-0 shadow-2xl" : "-translate-x-full"
        }`}
        style={{ width: sidebarWidth }}
      >
        {/* Header / Brand */}
        <div className="px-4 py-3.5 border-b border-zinc-200 dark:border-[#27272a] shrink-0 flex items-center justify-between">
          {loading ? (
            <div className="space-y-1.5 animate-pulse px-1 flex-1">
              <div className="h-3.5 bg-zinc-200 dark:bg-zinc-800 rounded w-24" />
              <div className="h-2 bg-zinc-200 dark:bg-zinc-800 rounded w-16" />
            </div>
          ) : user?.role === "admin" ? (
            <Link href="/admin" className="flex items-center gap-2.5 group px-1 flex-1">
              {user?.image ? (
                <img
                  src={user.image}
                  alt={userDisplayName}
                  className="w-8 h-8 rounded-full object-cover border border-zinc-300 dark:border-zinc-700 shrink-0"
                  referrerPolicy="no-referrer"
                />
              ) : (
                <img
                  src="/myicon.png"
                  alt="My Manager"
                  className="w-8 h-8 rounded-lg object-contain shrink-0"
                />
              )}
              <div className="min-w-0">
                <p className="text-sm font-bold text-zinc-900 dark:text-white tracking-tight leading-tight group-hover:text-zinc-600 dark:group-hover:text-zinc-300 transition">
                  My Manager
                </p>
                <p className="text-[10px] text-zinc-500 dark:text-zinc-400 leading-tight mt-0.5 flex items-center gap-1">
                  Dashboard & Workspace
                  <span className="inline-block px-1 py-px rounded text-[8px] font-bold uppercase bg-purple-500/15 text-purple-600 dark:text-purple-400 border border-purple-500/20 leading-none">Admin</span>
                </p>
              </div>
            </Link>
          ) : (
            <Link
              href="/admin/settings"
              className="flex items-center gap-2 group p-1 -m-1 rounded-xl hover:bg-zinc-100 dark:hover:bg-[#18181b] transition min-w-0 max-w-[calc(100%-3rem)]"
              title="View Profile"
            >
              {user?.image ? (
                <img
                  src={user.image}
                  alt={userDisplayName}
                  className="w-8 h-8 rounded-full object-cover border border-zinc-300 dark:border-zinc-700 shrink-0"
                  referrerPolicy="no-referrer"
                />
              ) : (
                <div className="w-8 h-8 rounded-full bg-indigo-600 border border-indigo-700 flex items-center justify-center text-xs font-bold text-white shrink-0">
                  {userInitial}
                </div>
              )}
              <div className="min-w-0 flex-1">
                <p className="text-xs font-bold text-zinc-900 dark:text-white tracking-tight leading-tight truncate">
                  {userDisplayName}
                </p>
                <p className="text-[10px] text-zinc-500 dark:text-zinc-400 leading-tight truncate flex items-center gap-1">
                  <span className="truncate">{user?.email}</span>
                  <span className="inline-block px-1 py-px rounded text-[8px] font-bold uppercase bg-blue-500/15 text-blue-600 dark:text-blue-400 border border-blue-500/20 leading-none shrink-0">Team</span>
                </p>
              </div>
            </Link>
          )}

          {/* Desktop Notification Bell */}
          <div className="hidden md:flex items-center shrink-0">
            <NotificationBell />
          </div>

          {/* Mobile Close Button */}
          <button
            onClick={() => setMobileMenuOpen(false)}
            className="md:hidden p-1.5 text-zinc-400 hover:text-zinc-900 dark:hover:text-white rounded-lg hover:bg-zinc-100 dark:hover:bg-zinc-800 transition cursor-pointer"
            title="Close menu"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Multi-workspace Switcher (shown when user has multiple workspaces) */}
        {workspaces.length > 1 && (
          <div className="px-3 py-2 border-b border-zinc-200 dark:border-[#27272a] bg-slate-50/50 dark:bg-zinc-900/30">
            <div className="relative">
              <button
                onClick={() => setShowWorkspaceDropdown((v) => !v)}
                className="w-full px-2.5 py-1.5 rounded-lg bg-white dark:bg-zinc-800/80 border border-zinc-200 dark:border-zinc-700/80 text-left text-xs flex items-center justify-between gap-2 hover:border-zinc-300 dark:hover:border-zinc-600 transition cursor-pointer shadow-xs"
              >
                <div className="min-w-0 flex-1">
                  <p className="text-[10px] text-zinc-400 dark:text-zinc-500 font-semibold uppercase tracking-wider">
                    Current Workspace
                  </p>
                  <p className="text-xs font-bold text-zinc-900 dark:text-white truncate">
                    {workspaces.find((w) => w.isCurrent)?.name || "Workspace"}
                  </p>
                </div>
                <svg
                  className={`w-3.5 h-3.5 text-zinc-400 transition-transform ${showWorkspaceDropdown ? "rotate-180" : ""}`}
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth={2}
                >
                  <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 8.25l-7.5 7.5-7.5-7.5" />
                </svg>
              </button>

              {showWorkspaceDropdown && (
                <div className="absolute left-0 right-0 top-full mt-1.5 bg-white dark:bg-[#18181b] border border-zinc-200 dark:border-zinc-700 rounded-xl shadow-xl z-50 p-1 space-y-1">
                  {workspaces.map((w) => (
                    <button
                      key={w.id}
                      onClick={() => handleSwitchWorkspace(w.id)}
                      disabled={w.isCurrent || switchingWorkspace}
                      className={`w-full px-2.5 py-2 rounded-lg text-left text-xs flex items-center justify-between gap-2 transition cursor-pointer ${
                        w.isCurrent
                          ? "bg-blue-50 dark:bg-blue-950/40 text-blue-700 dark:text-blue-300 font-semibold"
                          : "hover:bg-zinc-100 dark:hover:bg-zinc-800 text-zinc-700 dark:text-zinc-300"
                      }`}
                    >
                      <div className="min-w-0 flex-1">
                        <p className="truncate font-medium">{w.name}</p>
                        <p className="text-[10px] text-zinc-400 dark:text-zinc-500 truncate">
                          {w.role === "admin" ? "Admin" : "Team Member"} &middot; {w.email}
                        </p>
                      </div>
                      {w.isCurrent && (
                        <span className="w-1.5 h-1.5 rounded-full bg-blue-600 dark:bg-blue-400 shrink-0" />
                      )}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* Grouped Navigation */}
        <nav className="flex-1 px-3 py-3 overflow-y-auto admin-scroll space-y-4">
          {loading ? (
            <div className="flex items-center justify-center py-6">
              <div className="w-4 h-4 border-2 border-zinc-600 border-t-zinc-300 rounded-full animate-spin" />
            </div>
          ) : (
            visibleNavGroups.map((group) => (
              <div key={group.category} className="space-y-1">
                {/* Category Header */}
                <div className="px-2.5 pt-1 pb-1">
                  <p className="text-xs font-semibold text-zinc-500 tracking-wider uppercase select-none">
                    {group.category}
                  </p>
                </div>

                {/* Items in Category */}
                <div className="space-y-0.5">
                  {group.items.map((item) => {
                    const isActive =
                      item.href === "/admin"
                        ? pathname === "/admin"
                        : pathname === item.href || pathname.startsWith(item.href + "/");

                    return (
                      <Link
                        key={item.href}
                        href={item.href}
                        onClick={() => setMobileMenuOpen(false)}
                        className={`group flex items-center gap-2.5 px-2.5 py-2 rounded-xl text-xs font-medium transition-all duration-150 relative ${
                          isActive
                            ? "bg-blue-50/90 text-blue-700 border border-blue-200/80 dark:bg-zinc-800/90 dark:text-white dark:border-zinc-700/60 font-semibold shadow-xs"
                            : "text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100 hover:bg-zinc-100 dark:hover:bg-zinc-800/50 border border-transparent"
                        }`}
                      >
                        {isActive && (
                          <span className="absolute left-0 top-2 bottom-2 w-1 bg-blue-600 dark:bg-blue-500 rounded-r-full" />
                        )}
                        <span
                          className={`transition-colors duration-150 ${
                            isActive
                              ? "text-blue-600 dark:text-blue-400"
                              : "text-zinc-500 dark:text-zinc-400 group-hover:text-zinc-900 dark:group-hover:text-zinc-100"
                          }`}
                        >
                          {item.icon}
                        </span>
                        <span
                          className={`truncate ${
                            isActive
                              ? "text-blue-700 dark:text-white font-semibold"
                              : ""
                          }`}
                        >
                          {item.label}
                        </span>
                      </Link>
                    );
                  })}
                </div>
              </div>
            ))
          )}
        </nav>

        {/* Role Badge & Theme & Logout */}
        <div className="p-3 pb-3 border-t border-zinc-200 dark:border-[#27272a] shrink-0 space-y-2">
          {user && (
            <div className={`flex items-center gap-2 px-3 py-2 rounded-xl text-[11px] font-semibold border ${
              user.role === "admin"
                ? "bg-purple-500/5 text-purple-600 dark:text-purple-400 border-purple-500/15"
                : "bg-blue-500/5 text-blue-600 dark:text-blue-400 border-blue-500/15"
            }`}>
              {user.role === "admin" ? (
                <svg className="w-3.5 h-3.5 shrink-0" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M10.868 2.884c-.321-.772-1.415-.772-1.736 0l-1.83 4.401-4.753.381c-.833.067-1.171 1.107-.536 1.651l3.62 3.102 1.106 4.637c.12.513-.453.913-.875.67L4.5 14.127l-3.973 2.134c-.453.245-1.002-.134-.885-.64l1.05-4.496L.393 9.473c-.656-.563-.306-1.535.53-1.602l4.753-.381 1.83-4.401z" clipRule="evenodd" /></svg>
              ) : (
                <svg className="w-3.5 h-3.5 shrink-0" fill="currentColor" viewBox="0 0 20 20"><path d="M10 9a3 3 0 100-6 3 3 0 000 6zm-7 9a7 7 0 1114 0H3z" /></svg>
              )}
              <span>{user.role === "admin" ? "Admin Account" : "Team Member"}</span>
            </div>
          )}
          <ThemeToggle variant="segmented" />
          <button
            onClick={handleLogout}
            className="flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs font-medium text-zinc-600 dark:text-zinc-400 hover:text-red-600 dark:hover:text-red-400 hover:bg-red-500/10 border border-transparent hover:border-red-500/20 transition-all w-full cursor-pointer"
          >
            <svg className="w-4 h-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 9V5.25A2.25 2.25 0 0013.5 3h-6a2.25 2.25 0 00-2.25 2.25v13.5A2.25 2.25 0 007.5 21h6a2.25 2.25 0 002.25-2.25V15m3 0l3-3m0 0l-3-3m3 3H9" />
            </svg>
            <span>Logout</span>
          </button>
        </div>

        {/* Resize handle (Desktop only) */}
        <div
          onMouseDown={handleMouseDown}
          className="hidden md:block absolute top-0 right-0 bottom-0 w-1 cursor-col-resize hover:bg-[#3f3f46] active:bg-[#52525b] transition-colors z-10"
        />
      </aside>

      {/* Main Content Area with Smooth Momentum Scrolling */}
      <main
        ref={mainRef}
        className="flex-1 min-h-0 flex flex-col overflow-y-auto admin-scroll"
      >
        {/* Mobile Top Header with Burger Toggle */}
        <div className="md:hidden flex items-center justify-between px-4 py-3 border-b border-zinc-200 dark:border-zinc-800 bg-white dark:bg-[#09090b] sticky top-0 z-30 shrink-0">
          <div className="flex items-center gap-2.5">
            <button
              onClick={() => setMobileMenuOpen(true)}
              className="p-2 -ml-1 text-zinc-600 dark:text-zinc-300 hover:text-zinc-900 dark:hover:text-white bg-slate-100 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl transition cursor-pointer"
              title="Open Navigation Menu"
            >
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6.75h16.5M3.75 12h16.5m-16.5 5.25h16.5" />
              </svg>
            </button>
            <div className="flex items-center gap-2">
              <img src="/myicon.png" alt="My Manager" className="w-6 h-6 rounded-md object-contain" />
              <span className="text-sm font-bold text-zinc-900 dark:text-white tracking-tight">
                {currentSection?.label || "My Manager"}
              </span>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <NotificationBell />
            {user?.image ? (
              <img
                src={user.image}
                alt={userDisplayName}
                className="w-7 h-7 rounded-full object-cover border border-zinc-700"
                referrerPolicy="no-referrer"
              />
            ) : (
              <div className="w-7 h-7 rounded-full bg-blue-600 flex items-center justify-center text-[11px] font-bold text-white">
                {userInitial}
              </div>
            )}
          </div>
        </div>

        <div className="w-full flex-1 flex flex-col">
          {/* Permission Change Toast */}
          {permissionToast && (
            <div className="sticky top-0 z-50 mx-4 mt-3">
              <div className={`flex items-center gap-3 px-4 py-3 rounded-xl border text-sm font-medium shadow-lg backdrop-blur-sm transition-all ${
                permissionToast.startsWith("⚠️")
                  ? "bg-amber-50/95 dark:bg-amber-950/95 border-amber-200 dark:border-amber-800 text-amber-800 dark:text-amber-200"
                  : "bg-emerald-50/95 dark:bg-emerald-950/95 border-emerald-200 dark:border-emerald-800 text-emerald-800 dark:text-emerald-200"
              }`}>
                <span className="flex-1">{permissionToast}</span>
                <button
                  onClick={() => setPermissionToast(null)}
                  className="text-current opacity-50 hover:opacity-100 cursor-pointer"
                >
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            </div>
          )}
          {!isAuthorized ? (
            <div className="flex-1 flex items-center justify-center p-8 bg-[#09090b]">
              <div className="bg-[#111114] border border-[#27272a] rounded-2xl p-8 max-w-md w-full text-center">
                <div className="w-12 h-12 rounded-2xl bg-[#261307] border border-[#78350f] text-[#fbbf24] flex items-center justify-center mx-auto mb-4">
                  <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 10.5V6.75a4.5 4.5 0 10-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 002.25-2.25v-6.75a2.25 2.25 0 00-2.25-2.25H6.75a2.25 2.25 0 00-2.25 2.25v6.75a2.25 2.25 0 002.25 2.25z" />
                  </svg>
                </div>
                <h2 className="text-lg font-bold text-white mb-2">Access Restricted</h2>
                <p className="text-sm text-zinc-400 mb-6 leading-relaxed">
                  You do not have permission to access the <span className="text-white font-medium">{currentSection?.label || "requested"}</span> section.
                </p>
                {flatVisibleItems.length > 0 && (
                  <button
                    onClick={() => router.push(flatVisibleItems[0].href)}
                    className="w-full px-4 py-2.5 text-sm font-medium text-black bg-white hover:bg-zinc-200 rounded-xl cursor-pointer"
                  >
                    Go to {flatVisibleItems[0].label}
                  </button>
                )}
              </div>
            </div>
          ) : (
            children
          )}
        </div>
      </main>
    </div>
  );
}
