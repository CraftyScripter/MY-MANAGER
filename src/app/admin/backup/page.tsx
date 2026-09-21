"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";

interface BackupFile {
  id: string;
  name: string;
  size?: string;
  modifiedTime?: string;
}

export default function BackupRestorePage() {
  const [backups, setBackups] = useState<BackupFile[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [restoring, setRestoring] = useState<string | null>(null);
  const [selectedBackup, setSelectedBackup] = useState<string | null>(null);
  const [restoreOptions, setRestoreOptions] = useState({
    restorePayments: true,
    restoreEnquiries: true,
    restoreCredentials: true,
    restoreFormProjects: true,
    restoreInstagram: true,
    restoreActivityLogs: true,
    restoreAppointments: true,
  });
  const [showRestoreModal, setShowRestoreModal] = useState(false);
  const [toast, setToast] = useState<{ type: "success" | "error"; message: string } | null>(null);
  const [backupMessage, setBackupMessage] = useState<string | null>(null);

  const fetchBackups = useCallback(async () => {
    try {
      setLoading(true);
      setBackupMessage(null);
      const res = await fetch("/api/admin/google/backup");
      if (res.ok) {
        const data = await res.json();
        setBackups(data.backups || []);
        if (data.message) {
          setBackupMessage(data.message);
        }
      }
    } catch (err) {
      console.error("Failed to fetch backups:", err);
      setBackupMessage("Failed to connect to server");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchBackups();
  }, [fetchBackups]);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 5000);
    return () => clearTimeout(t);
  }, [toast]);

  const createBackup = async () => {
    setCreating(true);
    try {
      const res = await fetch("/api/admin/google/backup", { method: "POST" });
      const data = await res.json();
      if (res.ok) {
        setToast({ type: "success", message: "Backup created successfully!" });
        fetchBackups();
      } else {
        setToast({ type: "error", message: data.error || "Backup failed" });
      }
    } catch {
      setToast({ type: "error", message: "Network error while creating backup" });
    } finally {
      setCreating(false);
    }
  };

  const startRestore = (backupId: string) => {
    setSelectedBackup(backupId);
    setShowRestoreModal(true);
  };

  const confirmRestore = async () => {
    if (!selectedBackup) return;
    setRestoring(selectedBackup);
    setShowRestoreModal(false);

    try {
      const res = await fetch("/api/admin/google/backup/restore", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          backupFileId: selectedBackup,
          options: restoreOptions,
        }),
      });
      const data = await res.json();
      if (res.ok) {
        const restored = data.restored || {};
        const summary = Object.entries(restored)
          .filter(([_, count]) => (count as number) > 0)
          .map(([model, count]) => `${model}: ${count}`)
          .join(", ");
        setToast({
          type: "success",
          message: `Restore complete! ${summary || "No new records added."}`,
        });
      } else {
        setToast({ type: "error", message: data.error || "Restore failed" });
      }
    } catch {
      setToast({ type: "error", message: "Network error during restore" });
    } finally {
      setRestoring(null);
      setSelectedBackup(null);
    }
  };

  const formatSize = (bytes?: string) => {
    if (!bytes) return "—";
    const b = parseInt(bytes);
    if (b < 1024) return `${b} B`;
    if (b < 1024 * 1024) return `${(b / 1024).toFixed(1)} KB`;
    return `${(b / (1024 * 1024)).toFixed(1)} MB`;
  };

  return (
    <div className="p-4 md:p-8 max-w-5xl mx-auto space-y-6">
      {/* Toast */}
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

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-zinc-900 dark:text-white flex items-center gap-2">
            <svg className="w-5 h-5 text-amber-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
            </svg>
            Backup & Restore
          </h1>
          <p className="text-sm text-zinc-500 mt-1">
            Full encrypted backups of all your data stored on Google Drive
          </p>
        </div>
        <div className="flex gap-2">
          <Link
            href="/admin/settings"
            className="px-4 py-2.5 rounded-xl text-xs font-semibold bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 hover:bg-zinc-200 dark:hover:bg-zinc-700 transition"
          >
            ← Back to Settings
          </Link>
          <button
            onClick={createBackup}
            disabled={creating}
            className="px-4 py-2.5 rounded-xl text-xs font-semibold bg-amber-600 text-white hover:bg-amber-700 transition cursor-pointer disabled:opacity-50 shadow-sm"
          >
            {creating ? "⏳ Creating Backup..." : "🔒 Create Full Backup"}
          </button>
        </div>
      </div>

      {/* What's Included */}
      <div className="bg-white dark:bg-[#111114] border border-zinc-200 dark:border-zinc-800 rounded-2xl p-5">
        <h3 className="text-xs font-bold text-zinc-500 uppercase tracking-wider mb-3">What's Included in Backup</h3>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          {[
            { label: "Payments", icon: "💰", color: "emerald" },
            { label: "Enquiries", icon: "📝", color: "blue" },
            { label: "Credentials", icon: "🔐", color: "violet" },
            { label: "FormBridge", icon: "🔗", color: "purple" },
            { label: "Instagram", icon: "📸", color: "pink" },
            { label: "Appointments", icon: "📅", color: "cyan" },
            { label: "Team Users", icon: "👥", color: "indigo" },
            { label: "Env Variables", icon: "⚙️", color: "amber" },
          ].map((item) => (
            <div
              key={item.label}
              className="flex items-center gap-2 px-3 py-2 rounded-xl bg-zinc-50 dark:bg-zinc-900/50 border border-zinc-100 dark:border-zinc-800/50"
            >
              <span className="text-sm">{item.icon}</span>
              <span className="text-xs font-medium text-zinc-700 dark:text-zinc-300">{item.label}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Backup List */}
      <div className="bg-white dark:bg-[#111114] border border-zinc-200 dark:border-zinc-800 rounded-2xl overflow-hidden">
        <div className="px-5 py-4 border-b border-zinc-200 dark:border-zinc-800 flex items-center justify-between">
          <h3 className="text-sm font-bold text-zinc-900 dark:text-white">
            Available Backups ({backups.length})
          </h3>
          <button
            onClick={fetchBackups}
            className="text-xs text-blue-500 hover:underline font-semibold cursor-pointer"
          >
            Refresh
          </button>
        </div>

        {loading ? (
          <div className="py-12 flex items-center justify-center">
            <div className="w-6 h-6 border-2 border-zinc-600 border-t-zinc-300 rounded-full animate-spin" />
          </div>
        ) : backups.length === 0 ? (
          <div className="py-12 text-center">
            <div className="w-14 h-14 rounded-2xl bg-amber-500/10 border border-amber-500/20 text-amber-500 flex items-center justify-center mx-auto mb-3">
              <svg className="w-7 h-7" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M20.25 6.375c0 2.278-3.694 4.125-8.25 4.125S3.75 8.653 3.75 6.375m16.5 0c0-2.278-3.694-4.125-8.25-4.125S3.75 4.097 3.75 6.375m16.5 0v11.25c0 2.278-3.694 4.125-8.25 4.125s-8.25-1.847-8.25-4.125V6.375m16.5 0v3.75m-16.5-3.75v3.75m16.5 0v3.75C20.25 16.153 16.556 18 12 18s-8.25-1.847-8.25-4.125v-3.75m16.5 0c0 2.278-3.694 4.125-8.25 4.125s-8.25-1.847-8.25-4.125" />
              </svg>
            </div>
            <h3 className="text-sm font-bold text-zinc-900 dark:text-white">No backups yet</h3>
            {backupMessage && (
              <p className="text-xs text-amber-600 dark:text-amber-400 mt-1 mb-2 max-w-sm mx-auto">{backupMessage}</p>
            )}
            <p className="text-xs text-zinc-500 mt-1 mb-4">Create your first backup to protect your data</p>
            <button
              onClick={createBackup}
              disabled={creating}
              className="px-4 py-2 rounded-xl text-xs font-semibold bg-amber-600 text-white hover:bg-amber-700 transition cursor-pointer"
            >
              Create First Backup
            </button>
          </div>
        ) : (
          <div className="divide-y divide-zinc-100 dark:divide-zinc-800/50">
            {backups.map((backup) => (
              <div
                key={backup.id}
                className="px-5 py-3.5 flex items-center justify-between hover:bg-zinc-50 dark:hover:bg-zinc-900/30 transition"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <div className="w-9 h-9 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-500 flex items-center justify-center shrink-0">
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126z" />
                    </svg>
                  </div>
                  <div className="min-w-0">
                    <p className="text-xs font-semibold text-zinc-900 dark:text-white truncate font-mono">
                      {backup.name}
                    </p>
                    <p className="text-[10px] text-zinc-500 mt-0.5">
                      {formatSize(backup.size)} · {backup.modifiedTime ? new Date(backup.modifiedTime).toLocaleString() : "—"}
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => startRestore(backup.id)}
                  disabled={restoring === backup.id}
                  className="px-3 py-1.5 rounded-xl text-[11px] font-semibold bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 hover:bg-emerald-500/20 transition cursor-pointer disabled:opacity-50 shrink-0 ml-3"
                >
                  {restoring === backup.id ? "Restoring..." : "Restore"}
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Restore Modal */}
      {showRestoreModal && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-[#111114] border border-zinc-200 dark:border-zinc-800 rounded-2xl p-6 max-w-md w-full shadow-2xl">
            <h2 className="text-lg font-bold text-zinc-900 dark:text-white mb-2">Restore from Backup</h2>
            <p className="text-xs text-zinc-500 mb-4">
              Select which data to restore. Existing records will not be duplicated.
            </p>

            <div className="space-y-2 mb-5">
              {[
                { key: "restorePayments", label: "💰 Payments & Audit Logs" },
                { key: "restoreEnquiries", label: "📝 Contact & Promise Me Enquiries" },
                { key: "restoreCredentials", label: "🔐 Credentials & Links" },
                { key: "restoreFormProjects", label: "🔗 FormBridge Projects & Submissions" },
                { key: "restoreInstagram", label: "📸 Instagram Accounts & Posts" },
                { key: "restoreAppointments", label: "📅 Calendar Appointments" },
                { key: "restoreActivityLogs", label: "📋 Activity Logs" },
              ].map((opt) => (
                <label
                  key={opt.key}
                  className="flex items-center gap-3 p-2.5 rounded-xl bg-zinc-50 dark:bg-zinc-900/50 border border-zinc-100 dark:border-zinc-800/50 cursor-pointer hover:bg-zinc-100 dark:hover:bg-zinc-800/50 transition"
                >
                  <input
                    type="checkbox"
                    checked={(restoreOptions as any)[opt.key]}
                    onChange={(e) =>
                      setRestoreOptions({ ...restoreOptions, [opt.key]: e.target.checked })
                    }
                    className="rounded border-zinc-300 dark:border-zinc-700"
                  />
                  <span className="text-xs font-medium text-zinc-700 dark:text-zinc-300">{opt.label}</span>
                </label>
              ))}
            </div>

            <div className="flex gap-3">
              <button
                onClick={() => {
                  setShowRestoreModal(false);
                  setSelectedBackup(null);
                }}
                className="flex-1 px-4 py-2.5 rounded-xl text-sm font-semibold bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 hover:bg-zinc-200 dark:hover:bg-zinc-700 transition cursor-pointer"
              >
                Cancel
              </button>
              <button
                onClick={confirmRestore}
                className="flex-1 px-4 py-2.5 rounded-xl text-sm font-semibold bg-emerald-600 text-white hover:bg-emerald-700 transition cursor-pointer"
              >
                Restore Now
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
