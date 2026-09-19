"use client";

import { useEffect, useState, useRef } from "react";
import ConfirmModal from "@/components/ConfirmModal";

interface GoogleAccountStatus {
  id: string;
  email: string;
  name: string | null;
  picture: string | null;
  driveFolderName: string;
  driveFolderId: string | null;
  lastBackupAt: string | null;
  lastSyncAt: string | null;
}

export default function GoogleDriveIndicator() {
  const [connected, setConnected] = useState<boolean>(false);
  const [isAdmin, setIsAdmin] = useState<boolean>(true);
  const [account, setAccount] = useState<GoogleAccountStatus | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [backingUp, setBackingUp] = useState<boolean>(false);
  const [isOpen, setIsOpen] = useState<boolean>(false);
  const [showDisconnectConfirm, setShowDisconnectConfirm] = useState<boolean>(false);
  const [isDisconnecting, setIsDisconnecting] = useState<boolean>(false);
  const [message, setMessage] = useState<{ text: string; type: "success" | "error" } | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  async function checkStatus() {
    try {
      const res = await fetch("/api/admin/google/status");
      if (res.ok) {
        const data = await res.json();
        setConnected(Boolean(data.connected));
        setIsAdmin(Boolean(data.isAdmin));
        setAccount(data.account || null);
      }
    } catch {
      // Non-blocking fallback
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    checkStatus();

    // Listen for OAuth message if opened in popup
    function handleMessage(e: MessageEvent) {
      if (e.data?.type === "GOOGLE_AUTH_SUCCESS") {
        checkStatus();
        setMessage({ text: "Google Drive connected successfully!", type: "success" });
      }
    }
    window.addEventListener("message", handleMessage);

    // Click outside listener for dropdown
    function handleClickOutside(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);

    return () => {
      window.removeEventListener("message", handleMessage);
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, []);

  async function handleConnect() {
    if (!isAdmin) {
      setMessage({ text: "Only the Workspace Admin can connect or modify the Google Account.", type: "error" });
      return;
    }
    try {
      const res = await fetch("/api/admin/google/auth/url");
      const data = await res.json();
      if (data.authUrl) {
        // Open OAuth popup centered
        const width = 520;
        const height = 640;
        const left = window.screen.width / 2 - width / 2;
        const top = window.screen.height / 2 - height / 2;
        window.open(
          data.authUrl,
          "google_oauth",
          `width=${width},height=${height},top=${top},left=${left}`
        );
      } else {
        setMessage({ text: data.error || "Could not start Google Authentication. Please check environment credentials.", type: "error" });
      }
    } catch (err: any) {
      setMessage({ text: "Failed to initialize Google Login: " + (err?.message || "Unknown error"), type: "error" });
    }
  }

  async function handleBackup() {
    setBackingUp(true);
    setMessage(null);
    try {
      const res = await fetch("/api/admin/google/backup", { method: "POST" });
      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || "Backup failed");
      }
      setMessage({ text: "Encrypted backup saved to Google Drive!", type: "success" });
      await checkStatus();
    } catch (err: any) {
      setMessage({ text: err?.message || "Backup failed", type: "error" });
    } finally {
      setBackingUp(false);
    }
  }

  async function executeDisconnect() {
    setIsDisconnecting(true);
    try {
      await fetch("/api/admin/google/disconnect", { method: "POST" });
      setConnected(false);
      setAccount(null);
      setIsOpen(false);
      setMessage({ text: "Google account disconnected", type: "success" });
    } catch (err) {
      console.error(err);
    } finally {
      setIsDisconnecting(false);
      setShowDisconnectConfirm(false);
    }
  }

  const formatTimestamp = (dateStr?: string | null) => {
    if (!dateStr) return "Never";
    try {
      const date = new Date(dateStr);
      return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) + ", " + date.toLocaleDateString([], { month: "short", day: "numeric" });
    } catch {
      return "Unknown";
    }
  };

  if (loading) {
    return (
      <div className="flex items-center gap-2 px-2.5 py-1.5 rounded-lg bg-zinc-100/60 dark:bg-zinc-900/60 border border-zinc-200/60 dark:border-zinc-800/60 text-[11px] text-zinc-500 animate-pulse">
        <div className="w-2 h-2 rounded-full bg-zinc-400" />
        <span>Drive Sync</span>
      </div>
    );
  }

  return (
    <div className="relative" ref={containerRef}>
      {/* Trigger Button */}
      <button
        onClick={() => (connected ? setIsOpen(!isOpen) : isAdmin ? handleConnect() : null)}
        className={`w-full flex items-center justify-between gap-2 px-2.5 py-1.5 rounded-lg text-xs font-medium transition-all duration-150 cursor-pointer border ${
          connected
            ? "bg-zinc-100/80 dark:bg-zinc-900/80 hover:bg-zinc-200/70 dark:hover:bg-zinc-800/70 text-zinc-800 dark:text-zinc-200 border-zinc-200 dark:border-zinc-800"
            : isAdmin
            ? "bg-indigo-50/60 dark:bg-indigo-950/30 hover:bg-indigo-100/60 dark:hover:bg-indigo-900/40 text-indigo-700 dark:text-indigo-300 border-indigo-200/60 dark:border-indigo-800/40"
            : "bg-zinc-100/40 dark:bg-zinc-900/40 text-zinc-500 border-zinc-200/40 dark:border-zinc-800/40 cursor-default"
        }`}
        title={
          connected
            ? "Workspace Google Drive Active (Click for details & backup)"
            : isAdmin
            ? "Connect Workspace Google Drive Storage"
            : "Workspace Drive Pending (Admin will connect)"
        }
      >
        <div className="flex items-center gap-2 min-w-0">
          <div className="relative shrink-0">
            <svg className={`w-3.5 h-3.5 ${connected ? "text-emerald-500" : "text-indigo-500"}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M20.25 6.375c0 2.278-3.694 4.125-8.25 4.125S3.75 8.653 3.75 6.375m16.5 0c0-2.278-3.694-4.125-8.25-4.125S3.75 4.097 3.75 6.375m16.5 0v11.25c0 2.278-3.694 4.125-8.25 4.125s-8.25-1.847-8.25-4.125V6.375m16.5 5.625c0 2.278-3.694 4.125-8.25 4.125s-8.25-1.847-8.25-4.125" />
            </svg>
            <span
              className={`absolute -bottom-0.5 -right-0.5 w-1.5 h-1.5 rounded-full ring-1 ring-white dark:ring-zinc-950 ${
                connected ? "bg-emerald-500 animate-pulse" : "bg-amber-400"
              }`}
            />
          </div>
          <span className="truncate text-[11px]">
            {connected
              ? "Workspace Drive Active"
              : isAdmin
              ? "Connect Drive"
              : "Drive Sync Pending"}
          </span>
        </div>

        {connected && account?.lastBackupAt && (
          <span className="text-[10px] text-zinc-400 dark:text-zinc-500 shrink-0 font-mono">
            {new Date(account.lastBackupAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
          </span>
        )}
      </button>

      {/* Popover Card */}
      {isOpen && connected && (
        <div className="absolute bottom-full left-0 mb-2 w-72 p-3 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl shadow-xl z-50 text-xs text-zinc-800 dark:text-zinc-200 backdrop-blur-md">
          {/* Header */}
          <div className="flex items-center gap-2.5 pb-2.5 border-b border-zinc-100 dark:border-zinc-800">
            {account?.picture ? (
              <img src={account.picture} alt="" className="w-8 h-8 rounded-full ring-1 ring-zinc-200 dark:ring-zinc-700" />
            ) : (
              <div className="w-8 h-8 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-500 flex items-center justify-center font-bold">
                G
              </div>
            )}
            <div className="min-w-0 flex-1">
              <p className="font-semibold text-zinc-900 dark:text-zinc-100 truncate">{account?.name || "Workspace Admin Google"}</p>
              <p className="text-[10px] text-zinc-500 truncate">{account?.email}</p>
            </div>
            <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[9px] font-semibold bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
              <svg className="w-2.5 h-2.5 text-emerald-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
              </svg>
              Workspace
            </span>
          </div>

          {/* Details */}
          <div className="py-2.5 space-y-2 text-[11px]">
            <div className="flex items-center justify-between text-zinc-500 dark:text-zinc-400">
              <span className="flex items-center gap-1.5">
                <svg className="w-3.5 h-3.5 text-indigo-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M20.25 6.375c0 2.278-3.694 4.125-8.25 4.125S3.75 8.653 3.75 6.375m16.5 0c0-2.278-3.694-4.125-8.25-4.125S3.75 4.097 3.75 6.375m16.5 0v11.25c0 2.278-3.694 4.125-8.25 4.125s-8.25-1.847-8.25-4.125V6.375m16.5 5.625c0 2.278-3.694 4.125-8.25 4.125s-8.25-1.847-8.25-4.125" />
                </svg>
                BYO-Storage Folder:
              </span>
              <span className="font-mono text-zinc-800 dark:text-zinc-200 bg-zinc-100 dark:bg-zinc-800 px-1.5 py-0.5 rounded text-[10px]">
                {account?.driveFolderName || "MyManager_AppData"}
              </span>
            </div>

            <div className="flex items-center justify-between text-zinc-500 dark:text-zinc-400">
              <span className="flex items-center gap-1.5">
                <svg className="w-3.5 h-3.5 text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75m-3-7.036A11.959 11.959 0 013.598 6 11.99 11.99 0 003 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285z" />
                </svg>
                Encryption:
              </span>
              <span className="text-zinc-800 dark:text-zinc-200 font-medium">AES-256-GCM</span>
            </div>

            <div className="flex items-center justify-between text-zinc-500 dark:text-zinc-400">
              <span>Last Drive Backup:</span>
              <span className="text-zinc-700 dark:text-zinc-300 font-mono text-[10px]">
                {formatTimestamp(account?.lastBackupAt)}
              </span>
            </div>
          </div>

          {/* Feedback message */}
          {message && (
            <div
              className={`mb-2 p-2 rounded-lg text-[10px] flex items-center gap-1.5 ${
                message.type === "success"
                  ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20"
                  : "bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/20"
              }`}
            >
              <span>{message.text}</span>
            </div>
          )}

          {/* Actions */}
          <div className="pt-2 border-t border-zinc-100 dark:border-zinc-800 flex gap-2">
            <button
              onClick={handleBackup}
              disabled={backingUp}
              className="flex-1 py-1.5 px-2 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white rounded-lg text-[11px] font-medium flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
            >
              <svg className={`w-3 h-3 ${backingUp ? "animate-spin" : ""}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0l3.181 3.183a8.25 8.25 0 0013.803-3.7M4.031 9.865a8.25 8.25 0 0113.803-3.7l3.181 3.182" />
              </svg>
              {backingUp ? "Backing up..." : "Backup to Drive"}
            </button>

            {isAdmin && (
              <button
                onClick={() => setShowDisconnectConfirm(true)}
                className="p-1.5 text-zinc-400 hover:text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/30 rounded-lg transition-colors cursor-pointer"
                title="Disconnect Google Account"
              >
                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 9V5.25A2.25 2.25 0 0013.5 3h-6a2.25 2.25 0 00-2.25 2.25v13.5A2.25 2.25 0 007.5 21h6a2.25 2.25 0 002.25-2.25V15m3 0l3-3m0 0l-3-3m3 3H9" />
                </svg>
              </button>
            )}
          </div>
        </div>
      )}

      {/* Theme-based Disconnect Confirmation Dialog */}
      <ConfirmModal
        isOpen={showDisconnectConfirm}
        title="Disconnect Google Account"
        message="Are you sure you want to disconnect Google Drive & Sheets? Automatic backups and real-time syncing will pause until reconnected."
        confirmText="Disconnect"
        confirmVariant="danger"
        isLoading={isDisconnecting}
        onConfirm={executeDisconnect}
        onClose={() => setShowDisconnectConfirm(false)}
      />
    </div>
  );
}

