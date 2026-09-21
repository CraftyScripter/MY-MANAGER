"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import Link from "next/link";

export interface SystemNotification {
  id: string;
  title: string;
  description: string;
  timestamp: string;
  type: "form" | "finance" | "instagram" | "formbridge" | "backup" | "team" | "booking";
  href: string;
}

function timeAgo(dateString: string): string {
  const now = new Date();
  const past = new Date(dateString);
  const diffSec = Math.floor((now.getTime() - past.getTime()) / 1000);

  if (diffSec < 60) return "Just now";
  const diffMin = Math.floor(diffSec / 60);
  if (diffMin < 60) return `${diffMin}m ago`;
  const diffHours = Math.floor(diffMin / 60);
  if (diffHours < 24) return `${diffHours}h ago`;
  const diffDays = Math.floor(diffHours / 24);
  if (diffDays < 7) return `${diffDays}d ago`;
  return past.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

export default function NotificationBell() {
  const [notifications, setNotifications] = useState<SystemNotification[]>([]);
  const [readIds, setReadIds] = useState<Set<string>>(new Set());
  const [notificationsClearedAt, setNotificationsClearedAt] = useState<Date | null>(null);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [popupStyle, setPopupStyle] = useState<React.CSSProperties>({});
  const router = useRouter();
  const triggerRef = useRef<HTMLDivElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  const calculatePosition = useCallback(() => {
    if (!triggerRef.current) return;
    const rect = triggerRef.current.getBoundingClientRect();
    const w = Math.min(384, window.innerWidth - 24);

    let left = rect.right - w;
    if (left < 12) {
      left = 12;
    }
    if (left + w > window.innerWidth - 12) {
      left = Math.max(12, window.innerWidth - w - 12);
    }

    const top = rect.bottom + 8;
    const maxHeight = Math.min(500, window.innerHeight - top - 16);

    setPopupStyle({
      position: "fixed",
      top: `${top}px`,
      left: `${left}px`,
      width: `${w}px`,
      maxHeight: `${maxHeight}px`,
      zIndex: 99999,
    });
  }, []);

  // Load readIds and clearedAt from localStorage
  useEffect(() => {
    try {
      const stored = localStorage.getItem("pm_read_notifications");
      if (stored) {
        setReadIds(new Set(JSON.parse(stored)));
      }
      const clearedAt = localStorage.getItem("pm_notifications_cleared_at");
      if (clearedAt) {
        setNotificationsClearedAt(new Date(clearedAt));
      }
    } catch {}
  }, []);

  const fetchNotifications = useCallback(async () => {
    try {
      setLoading(true);
      const res = await fetch("/api/admin/notifications");
      if (res.ok) {
        const data = await res.json();
        const allNotifications = data.notifications || [];
        // Filter out notifications that were cleared
        if (notificationsClearedAt) {
          setNotifications(
            allNotifications.filter(
              (n: SystemNotification) => new Date(n.timestamp) > notificationsClearedAt
            )
          );
        } else {
          setNotifications(allNotifications);
        }
      }
    } catch {
      // Ignore network errors
    } finally {
      setLoading(false);
    }
  }, [notificationsClearedAt]);

  useEffect(() => {
    fetchNotifications();
    const interval = setInterval(fetchNotifications, 60000);
    return () => clearInterval(interval);
  }, [fetchNotifications]);

  const handleToggle = () => {
    if (!open) {
      calculatePosition();
      setOpen(true);
      fetchNotifications();
    } else {
      setOpen(false);
    }
  };

  useEffect(() => {
    if (!open) return;

    const handleUpdate = () => calculatePosition();
    const handleClickOutside = (e: MouseEvent) => {
      const target = e.target as Node;
      if (triggerRef.current && triggerRef.current.contains(target)) return;
      if (menuRef.current && menuRef.current.contains(target)) return;
      setOpen(false);
    };
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };

    window.addEventListener("scroll", handleUpdate, true);
    window.addEventListener("resize", handleUpdate);
    document.addEventListener("mousedown", handleClickOutside);
    document.addEventListener("keydown", handleKeyDown);

    return () => {
      window.removeEventListener("scroll", handleUpdate, true);
      window.removeEventListener("resize", handleUpdate);
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [open, calculatePosition]);

  const unreadCount = notifications.filter((n) => !readIds.has(n.id)).length;

  const markAllAsRead = () => {
    const allIds = notifications.map((n) => n.id);
    const newSet = new Set([...readIds, ...allIds]);
    setReadIds(newSet);
    try {
      localStorage.setItem("pm_read_notifications", JSON.stringify(Array.from(newSet)));
    } catch {}
  };

  const clearAllNotifications = () => {
    const now = new Date();
    setNotifications([]);
    setReadIds(new Set());
    setNotificationsClearedAt(now);
    try {
      localStorage.removeItem("pm_read_notifications");
      localStorage.setItem("pm_notifications_cleared_at", now.toISOString());
    } catch {}
  };

  const markSingleAsRead = (id: string) => {
    const newSet = new Set(readIds);
    newSet.add(id);
    setReadIds(newSet);
    try {
      localStorage.setItem("pm_read_notifications", JSON.stringify(Array.from(newSet)));
    } catch {}
  };

  const handleNotificationClick = (n: SystemNotification) => {
    markSingleAsRead(n.id);
    setOpen(false);
    router.push(n.href);
  };

  const getTypeIcon = (type: SystemNotification["type"]) => {
    switch (type) {
      case "form":
        return (
          <div className="w-8 h-8 rounded-lg bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/20 flex items-center justify-center shrink-0">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
            </svg>
          </div>
        );
      case "formbridge":
        return (
          <div className="w-8 h-8 rounded-lg bg-purple-500/10 text-purple-600 dark:text-purple-400 border border-purple-500/20 flex items-center justify-center shrink-0">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M13.19 8.688a4.5 4.5 0 011.242 7.244l-4.5 4.5a4.5 4.5 0 01-6.364-6.364l1.757-1.757m9.86-4.257a4.5 4.5 0 00-6.364-6.364L4.5 7.5l4.5 4.5-1.757 1.757a4.5 4.5 0 006.364 6.364l4.5-4.5a4.5 4.5 0 00-.324-.693z" />
            </svg>
          </div>
        );
      case "finance":
        return (
          <div className="w-8 h-8 rounded-lg bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 flex items-center justify-center shrink-0">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v12m-3-2.818l.879.659c1.171.879 3.07.879 4.242 0 1.172-.879 1.172-2.303 0-3.182C13.536 12.219 12.768 12 12 12c-.725 0-1.45-.22-2.003-.659-1.106-.879-1.106-2.303 0-3.182s2.9-.879 4.006 0l.415.33M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
        );
      case "instagram":
        return (
          <div className="w-8 h-8 rounded-lg bg-pink-500/10 text-pink-600 dark:text-pink-400 border border-pink-500/20 flex items-center justify-center shrink-0">
            <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
              <rect x="2" y="2" width="20" height="20" rx="5" ry="5" />
              <circle cx="12" cy="12" r="4" />
            </svg>
          </div>
        );
      case "booking":
        return (
          <div className="w-8 h-8 rounded-lg bg-cyan-500/10 text-cyan-600 dark:text-cyan-400 border border-cyan-500/20 flex items-center justify-center shrink-0">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 012.25-2.25h13.5A2.25 2.25 0 0121 7.5v11.25m-18 0A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75m-18 0v-7.5A2.25 2.25 0 015.25 9h13.5A2.25 2.25 0 0121 9v7.5" />
            </svg>
          </div>
        );
      case "team":
        return (
          <div className="w-8 h-8 rounded-lg bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border border-indigo-500/20 flex items-center justify-center shrink-0">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 19.128a9.38 9.38 0 002.625.372 9.337 9.337 0 004.121-.952 4.125 4.125 0 00-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 018.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0111.964-3.07M12 6.375a3.375 3.375 0 11-6.75 0 3.375 3.375 0 016.75 0zm8.25 2.25a2.625 2.625 0 11-5.25 0 2.625 2.625 0 015.25 0z" />
            </svg>
          </div>
        );
      case "backup":
      default:
        return (
          <div className="w-8 h-8 rounded-lg bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20 flex items-center justify-center shrink-0">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
            </svg>
          </div>
        );
    }
  };

  return (
    <div ref={triggerRef} className="relative inline-block">
      {/* Bell Button */}
      <button
        type="button"
        onClick={handleToggle}
        className="relative p-2 rounded-xl text-zinc-600 dark:text-zinc-300 hover:text-zinc-900 dark:hover:text-white bg-slate-100 hover:bg-slate-200 dark:bg-zinc-800/80 dark:hover:bg-zinc-700/80 border border-zinc-200 dark:border-zinc-700/60 transition-all cursor-pointer shadow-xs active:scale-95"
        title="Notifications"
        aria-label="View notifications"
      >
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M14.857 17.082a23.848 23.848 0 005.454-1.31A8.967 8.967 0 0118 9.75v-.7V9A6 6 0 006 9v.75a8.967 8.967 0 01-2.312 6.022c1.733.64 3.56 1.085 5.455 1.31m5.714 0a24.255 24.255 0 01-5.714 0m5.714 0a3 3 0 11-5.714 0" />
        </svg>

        {unreadCount > 0 && (
          <span className="absolute -top-1 -right-1 min-w-[18px] h-[18px] px-1 bg-blue-600 text-white text-[10px] font-bold rounded-full flex items-center justify-center shadow-md animate-in zoom-in">
            {unreadCount > 9 ? "9+" : unreadCount}
          </span>
        )}
      </button>

      {/* Popover Dropdown via React Portal to prevent viewport clipping */}
      {open && typeof document !== "undefined" && createPortal(
        <div
          ref={menuRef}
          style={popupStyle}
          className="bg-white dark:bg-[#121215] border border-zinc-200 dark:border-zinc-800 rounded-2xl shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-150 flex flex-col font-sans"
        >
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-zinc-200 dark:border-zinc-800 bg-slate-50 dark:bg-zinc-900/40 shrink-0">
            <div className="flex items-center gap-2">
              <h3 className="text-xs font-bold text-zinc-900 dark:text-white uppercase tracking-wider">
                Notifications
              </h3>
              {unreadCount > 0 && (
                <span className="px-2 py-0.5 text-[10px] font-bold bg-blue-500/10 text-blue-600 dark:text-blue-400 rounded-full border border-blue-500/20">
                  {unreadCount} unread
                </span>
              )}
            </div>
            <div className="flex items-center gap-2">
              {notifications.length > 0 && (
                <button
                  type="button"
                  onClick={clearAllNotifications}
                  className="text-[11px] font-semibold text-red-500 dark:text-red-400 hover:underline cursor-pointer"
                >
                  Clear All
                </button>
              )}
              {unreadCount > 0 && (
                <button
                  type="button"
                  onClick={markAllAsRead}
                  className="text-[11px] font-semibold text-blue-600 dark:text-blue-400 hover:underline cursor-pointer"
                >
                  Mark all read
                </button>
              )}
            </div>
          </div>

          {/* List */}
          <div className="overflow-y-auto divide-y divide-zinc-100 dark:divide-zinc-800/60 overscroll-contain flex-1">
            {loading && notifications.length === 0 ? (
              <div className="py-8 flex items-center justify-center">
                <div className="w-5 h-5 border-2 border-zinc-400 dark:border-zinc-600 border-t-blue-600 rounded-full animate-spin" />
              </div>
            ) : notifications.length === 0 ? (
              <div className="py-10 text-center px-4">
                <div className="w-10 h-10 rounded-full bg-slate-100 dark:bg-zinc-800 flex items-center justify-center mx-auto mb-2 text-zinc-400">
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M14.857 17.082a23.848 23.848 0 005.454-1.31A8.967 8.967 0 0118 9.75v-.7V9A6 6 0 006 9v.75a8.967 8.967 0 01-2.312 6.022c1.733.64 3.56 1.085 5.455 1.31m5.714 0a24.255 24.255 0 01-5.714 0m5.714 0a3 3 0 11-5.714 0" />
                  </svg>
                </div>
                <p className="text-xs font-semibold text-zinc-700 dark:text-zinc-300">All caught up!</p>
                <p className="text-[11px] text-zinc-400 mt-0.5">No notifications right now.</p>
              </div>
            ) : (
              notifications.map((n) => {
                const isRead = readIds.has(n.id);
                return (
                  <div
                    key={n.id}
                    onClick={() => handleNotificationClick(n)}
                    className={`p-3.5 flex items-start gap-3 hover:bg-slate-50 dark:hover:bg-zinc-800/50 transition cursor-pointer ${
                      !isRead ? "bg-blue-50/40 dark:bg-blue-950/10" : ""
                    }`}
                  >
                    {getTypeIcon(n.type)}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-1">
                        <p className={`text-xs truncate ${!isRead ? "font-bold text-zinc-900 dark:text-white" : "font-medium text-zinc-700 dark:text-zinc-300"}`}>
                          {n.title}
                        </p>
                        <span className="text-[10px] text-zinc-400 shrink-0">
                          {timeAgo(n.timestamp)}
                        </span>
                      </div>
                      <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5 line-clamp-2 leading-relaxed">
                        {n.description}
                      </p>
                    </div>
                    {!isRead && (
                      <span className="w-2 h-2 rounded-full bg-blue-600 dark:bg-blue-500 shrink-0 mt-1.5" />
                    )}
                  </div>
                );
              })
            )}
          </div>

          {/* Footer */}
          <div className="px-4 py-2.5 border-t border-zinc-200 dark:border-zinc-800 bg-slate-50 dark:bg-zinc-900/40 flex items-center justify-between text-xs shrink-0">
            <Link
              href="/admin/settings?tab=notifications"
              onClick={() => setOpen(false)}
              className="text-zinc-500 hover:text-zinc-900 dark:hover:text-white text-[11px] transition"
            >
              Notification Settings
            </Link>
            <button
              type="button"
              onClick={fetchNotifications}
              className="text-blue-600 dark:text-blue-400 hover:underline text-[11px] font-semibold cursor-pointer"
            >
              Refresh
            </button>
          </div>
        </div>,
        document.body
      )}
    </div>
  );
}
