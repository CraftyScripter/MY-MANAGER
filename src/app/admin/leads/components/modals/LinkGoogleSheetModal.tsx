"use client";

import { useEffect, useState } from "react";
import ConfirmModal from "@/components/ConfirmModal";

interface GoogleSheetLinkItem {
  id: string;
  spreadsheetId: string;
  spreadsheetName: string | null;
  sheetName: string | null;
  sheetUrl: string;
  syncStatus: string;
  lastSyncedAt: string | null;
  lastError: string | null;
  fileId?: string | null;
  tabId?: string | null;
}

interface DriveSpreadsheet {
  id: string;
  name: string;
  modifiedTime?: string;
  webViewLink?: string;
}

interface GoogleAccountInfo {
  id: string;
  name: string | null;
  email: string;
  picture: string | null;
}

interface LinkGoogleSheetModalProps {
  isOpen: boolean;
  onClose: () => void;
  tabId?: string;
  fileId?: string;
  onSyncComplete?: () => void;
  onOpenFile?: (fileId: string) => void;
}

export default function LinkGoogleSheetModal({
  isOpen,
  onClose,
  tabId,
  fileId,
  onSyncComplete,
  onOpenFile,
}: LinkGoogleSheetModalProps) {
  const [activeTab, setActiveTab] = useState<"drive" | "connected" | "manual">("drive");
  const [sheetUrl, setSheetUrl] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [links, setLinks] = useState<GoogleSheetLinkItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [linking, setLinking] = useState(false);
  const [linkingSheetId, setLinkingSheetId] = useState<string | null>(null);
  const [syncingLinkId, setSyncingLinkId] = useState<string | null>(null);
  const [driveSheets, setDriveSheets] = useState<DriveSpreadsheet[]>([]);
  const [loadingDriveSheets, setLoadingDriveSheets] = useState(false);
  const [googleAccount, setGoogleAccount] = useState<GoogleAccountInfo | null>(null);
  const [googleConnected, setGoogleConnected] = useState(true);
  const [hasDriveScope, setHasDriveScope] = useState(true);
  const [feedback, setFeedback] = useState<{ text: string; type: "success" | "error" } | null>(null);
  const [unlinkingLink, setUnlinkingLink] = useState<GoogleSheetLinkItem | null>(null);
  const [isUnlinking, setIsUnlinking] = useState(false);

  useEffect(() => {
    if (isOpen) {
      fetchCurrentLinks();
      fetchDriveSheets();
    }
  }, [isOpen, tabId]);

  useEffect(() => {
    function handleMessage(e: MessageEvent) {
      if (e.data?.type === "GOOGLE_AUTH_SUCCESS") {
        fetchDriveSheets();
        fetchCurrentLinks();
        setFeedback({ text: "Google account connected successfully!", type: "success" });
      }
    }
    window.addEventListener("message", handleMessage);
    return () => window.removeEventListener("message", handleMessage);
  }, []);

  async function fetchCurrentLinks() {
    setLoading(true);
    try {
      const url = `/api/admin/leads/google-sheets`;
      const res = await fetch(url);
      const data = await res.json();
      if (res.ok) {
        const fetchedLinks = data.links || [];
        setLinks(fetchedLinks);
        // Refresh the file tree in case auto-fix created new files
        window.dispatchEvent(new Event("leads-tree-refresh"));
      }
    } catch {
      // Non-blocking fallback
    } finally {
      setLoading(false);
    }
  }

  async function fetchDriveSheets() {
    setLoadingDriveSheets(true);
    try {
      const res = await fetch("/api/admin/google/sheets/list");
      if (res.status === 401) {
        setGoogleConnected(false);
        setGoogleAccount(null);
        return;
      }
      const data = await res.json();
      if (res.ok) {
        setDriveSheets(data.spreadsheets || []);
        setGoogleConnected(true);
        setHasDriveScope(data.hasDriveScope ?? true);
        if (data.account) {
          setGoogleAccount(data.account);
        }
      }
    } catch {
      // Non-blocking fallback
    } finally {
      setLoadingDriveSheets(false);
    }
  }

  async function handleConnectGoogle(prompt: string = "consent") {
    try {
      const res = await fetch(`/api/admin/google/auth/url?prompt=${encodeURIComponent(prompt)}`);
      const data = await res.json();
      if (data.authUrl) {
        const width = 520;
        const height = 640;
        const left = window.screen.width / 2 - width / 2;
        const top = window.screen.height / 2 - height / 2;
        window.open(
          data.authUrl,
          "google_oauth",
          `width=${width},height=${height},top=${top},left=${left}`
        );
      }
    } catch (err: any) {
      setFeedback({ text: "Failed to initialize Google login: " + err?.message, type: "error" });
    }
  }

  async function handleLink(targetUrl?: string, autoOpen: boolean = true, targetSheetId?: string) {
    const urlToUse = (targetUrl || sheetUrl).trim();
    if (!urlToUse) return;
    setLinking(true);
    if (targetSheetId) setLinkingSheetId(targetSheetId);
    setFeedback(null);
    try {
      const res = await fetch("/api/admin/leads/google-sheets", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sheetUrl: urlToUse,
          tabId,
        }),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || "Failed to connect Google Sheet");
      }

      setSheetUrl("");
      setFeedback({
        text: `Connected "${data.link.spreadsheetName || "Google Sheet"}" successfully!`,
        type: "success",
      });
      await fetchCurrentLinks();
      if (typeof window !== "undefined") {
        window.dispatchEvent(new Event("leads-tree-refresh"));
      }
      if (onSyncComplete) onSyncComplete();

      // Auto-open sheet in the workspace pipeline
      if (autoOpen && data.link?.fileId && onOpenFile) {
        onOpenFile(data.link.fileId);
        onClose();
      }
    } catch (err: any) {
      setFeedback({
        text: err?.message || "Failed to connect Google Sheet",
        type: "error",
      });
    } finally {
      setLinking(false);
      setLinkingSheetId(null);
    }
  }

  async function handleManualSync(link: GoogleSheetLinkItem) {
    setSyncingLinkId(link.id);
    setFeedback(null);
    try {
      const res = await fetch("/api/admin/leads/google-sheets", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ linkId: link.id }),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || "Sync failed");
      }

      setFeedback({
        text: `Synced "${link.spreadsheetName || "Sheet"}" successfully (${data.syncResult?.importedCount || 0} new, ${data.syncResult?.updatedCount || 0} updated).`,
        type: "success",
      });
      await fetchCurrentLinks();
      if (typeof window !== "undefined") {
        window.dispatchEvent(new Event("leads-tree-refresh"));
      }
      if (onSyncComplete) onSyncComplete();
    } catch (err: any) {
      setFeedback({
        text: err?.message || "Sync failed",
        type: "error",
      });
    } finally {
      setSyncingLinkId(null);
    }
  }

  async function executeUnlink() {
    if (!unlinkingLink) return;
    setIsUnlinking(true);
    try {
      const res = await fetch(`/api/admin/leads/google-sheets?linkId=${unlinkingLink.id}`, {
        method: "DELETE",
      });
      if (res.ok) {
        setLinks((prev) => prev.filter((l) => l.id !== unlinkingLink.id));
        setFeedback({ text: "Google Sheet disconnected successfully", type: "success" });
        if (typeof window !== "undefined") {
          window.dispatchEvent(new Event("leads-tree-refresh"));
        }
        if (onSyncComplete) onSyncComplete();
      }
    } catch (err: any) {
      setFeedback({ text: err?.message || "Failed to disconnect", type: "error" });
    } finally {
      setIsUnlinking(false);
      setUnlinkingLink(null);
    }
  }

  const filteredDriveSheets = driveSheets.filter((s) =>
    s.name.toLowerCase().includes(searchQuery.toLowerCase().trim())
  );

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-xs animate-in fade-in duration-150">
      <div className="w-full max-w-2xl bg-white dark:bg-[#121215] border border-zinc-200 dark:border-zinc-800 rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[88vh]">
        {/* Modal Header */}
        <div className="px-6 py-4 border-b border-zinc-200 dark:border-zinc-800/80 flex items-center justify-between bg-zinc-50/70 dark:bg-zinc-900/60">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-600 dark:text-emerald-400 flex items-center justify-center shrink-0">
              <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
              </svg>
            </div>
            <div>
              <h3 className="text-base font-bold text-zinc-900 dark:text-zinc-100">
                Google Sheets Manager
              </h3>
              <p className="text-xs text-zinc-500 dark:text-zinc-400">
                Directly access, link, and sync spreadsheets from your Google account
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200 rounded-xl hover:bg-zinc-100 dark:hover:bg-zinc-800 transition cursor-pointer"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Connected Account Banner */}
        <div className="px-6 py-2.5 bg-slate-50 dark:bg-zinc-900/40 border-b border-zinc-200 dark:border-zinc-800 flex items-center justify-between gap-3">
          {googleConnected && googleAccount ? (
            <div className="flex items-center gap-2.5 min-w-0">
              {googleAccount.picture ? (
                <img
                  src={googleAccount.picture}
                  alt=""
                  className="w-6 h-6 rounded-full object-cover border border-zinc-200 dark:border-zinc-700 shrink-0"
                  referrerPolicy="no-referrer"
                />
              ) : (
                <div className="w-6 h-6 rounded-full bg-emerald-500/10 text-emerald-600 font-bold flex items-center justify-center text-[10px] shrink-0 border border-emerald-500/20">
                  G
                </div>
              )}
              <div className="min-w-0 flex items-center gap-2 flex-wrap">
                <span className="text-xs font-bold text-zinc-900 dark:text-white truncate">
                  {googleAccount.name || "Connected Account"}
                </span>
                <span className="text-[11px] text-zinc-500 dark:text-zinc-400 font-mono truncate">
                  ({googleAccount.email})
                </span>
                <span className="inline-flex items-center gap-1 px-1.5 py-0.2 rounded-full text-[9px] font-semibold bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                  Connected
                </span>
              </div>
            </div>
          ) : (
            <div className="flex items-center justify-between w-full">
              <div className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-amber-500" />
                <span className="text-xs font-medium text-zinc-600 dark:text-zinc-300">
                  Google account not connected
                </span>
              </div>
              <button
                onClick={() => handleConnectGoogle("consent")}
                className="px-3 py-1 bg-blue-600 hover:bg-blue-500 text-white rounded-lg text-xs font-semibold shadow-xs cursor-pointer"
              >
                Sign in with Google
              </button>
            </div>
          )}

          {googleConnected && (
            <div className="flex items-center gap-1.5 shrink-0">
              {!hasDriveScope && (
                <button
                  onClick={() => handleConnectGoogle("consent")}
                  className="px-2.5 py-1 text-[11px] font-bold text-amber-700 dark:text-amber-300 bg-amber-500/15 hover:bg-amber-500/25 border border-amber-500/30 rounded-lg transition cursor-pointer flex items-center gap-1"
                >
                  <svg className="w-3 h-3 text-amber-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z" />
                  </svg>
                  <span>Grant Drive Access</span>
                </button>
              )}
              <button
                onClick={() => handleConnectGoogle("consent")}
                className="px-2 py-1 text-[11px] font-medium text-zinc-500 dark:text-zinc-400 hover:text-zinc-800 dark:hover:text-zinc-200 hover:bg-zinc-200/60 dark:hover:bg-zinc-800 rounded-lg transition cursor-pointer"
                title="Switch account or grant new permissions"
              >
                Switch
              </button>
              <button
                onClick={() => {
                  fetchDriveSheets();
                  fetchCurrentLinks();
                }}
                disabled={loadingDriveSheets}
                className="p-1.5 text-zinc-500 hover:text-zinc-800 dark:text-zinc-400 dark:hover:text-zinc-200 rounded-lg hover:bg-zinc-200/60 dark:hover:bg-zinc-800 transition cursor-pointer shrink-0"
                title="Refresh spreadsheets"
              >
                <svg className={`w-3.5 h-3.5 ${loadingDriveSheets ? "animate-spin text-emerald-500" : ""}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0l3.181 3.183a8.25 8.25 0 0013.803-3.7M4.031 9.865a8.25 8.25 0 0113.803-3.7l3.181 3.182" />
                </svg>
              </button>
            </div>
          )}
        </div>

        {/* Tab Switcher */}
        <div className="px-6 pt-3 pb-2 border-b border-zinc-200 dark:border-zinc-800 flex gap-2 bg-zinc-50/30 dark:bg-zinc-900/30">
          <button
            onClick={() => setActiveTab("drive")}
            className={`px-4 py-2 rounded-xl text-xs font-semibold transition-all flex items-center gap-2 cursor-pointer ${
              activeTab === "drive"
                ? "bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white shadow-xs border border-zinc-200 dark:border-zinc-700"
                : "text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-800/50"
            }`}
          >
            <svg className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
            </svg>
            <span>Your Google Sheets</span>
            {driveSheets.length > 0 && (
              <span className="px-1.5 py-0.2 rounded-full text-[10px] font-bold bg-emerald-500/15 text-emerald-600 dark:text-emerald-400">
                {driveSheets.length}
              </span>
            )}
          </button>

          <button
            onClick={() => setActiveTab("connected")}
            className={`px-4 py-2 rounded-xl text-xs font-semibold transition-all flex items-center gap-2 cursor-pointer ${
              activeTab === "connected"
                ? "bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white shadow-xs border border-zinc-200 dark:border-zinc-700"
                : "text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-800/50"
            }`}
          >
            <span>Linked in Workspace</span>
            <span
              className={`px-1.5 py-0.2 rounded-full text-[10px] font-bold ${
                activeTab === "connected"
                  ? "bg-emerald-500/20 text-emerald-600 dark:text-emerald-400"
                  : "bg-zinc-200 dark:bg-zinc-700 text-zinc-600 dark:text-zinc-400"
              }`}
            >
              {links.length}
            </span>
          </button>

          <button
            onClick={() => setActiveTab("manual")}
            className={`px-3.5 py-2 rounded-xl text-xs font-semibold transition-all flex items-center gap-1.5 cursor-pointer ${
              activeTab === "manual"
                ? "bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white shadow-xs border border-zinc-200 dark:border-zinc-700"
                : "text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-800/50"
            }`}
          >
            <span>Custom URL</span>
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-6 overflow-y-auto space-y-4 flex-1">
          {/* Feedback banner */}
          {feedback && (
            <div
              className={`p-3.5 rounded-xl text-xs flex items-center justify-between gap-2.5 animate-in fade-in duration-150 ${
                feedback.type === "success"
                  ? "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border border-emerald-500/20 font-medium"
                  : "bg-rose-500/10 text-rose-700 dark:text-rose-300 border border-rose-500/20 font-medium"
              }`}
            >
              <div className="flex items-center gap-2">
                {feedback.type === "success" ? (
                  <svg className="w-4 h-4 shrink-0 text-emerald-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                  </svg>
                ) : (
                  <svg className="w-4 h-4 shrink-0 text-rose-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z" />
                  </svg>
                )}
                <span>{feedback.text}</span>
              </div>
              <button
                onClick={() => setFeedback(null)}
                className="text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200 text-xs"
              >
                ✕
              </button>
            </div>
          )}

          {/* TAB 1: Your Google Sheets (From Connected Account) */}
          {activeTab === "drive" && (
            <div className="space-y-4">
              {!googleConnected ? (
                <div className="py-12 text-center bg-zinc-50 dark:bg-zinc-800/30 rounded-2xl border border-dashed border-zinc-200 dark:border-zinc-800 p-6">
                  <div className="w-12 h-12 rounded-2xl bg-blue-500/10 border border-blue-500/20 text-blue-500 flex items-center justify-center mx-auto mb-3">
                    <svg className="w-6 h-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0A17.933 17.933 0 0112 21.75c-2.676 0-5.216-.584-7.499-1.632z" />
                    </svg>
                  </div>
                  <h4 className="text-sm font-bold text-zinc-900 dark:text-zinc-100 mb-1">
                    Connect Your Google Account
                  </h4>
                  <p className="text-xs text-zinc-500 dark:text-zinc-400 mb-4 max-w-sm mx-auto">
                    Sign in with your Google account to view and link your Google Sheets automatically with a single click.
                  </p>
                  <button
                    onClick={() => handleConnectGoogle("consent")}
                    className="px-4 py-2.5 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-xs font-bold transition shadow-xs cursor-pointer inline-flex items-center gap-2"
                  >
                    <span>Connect Google Account</span>
                  </button>
                </div>
              ) : !hasDriveScope ? (
                <div className="py-10 px-6 text-center bg-amber-500/5 dark:bg-amber-950/20 rounded-2xl border border-amber-500/30 p-6">
                  <div className="w-12 h-12 rounded-2xl bg-amber-500/10 border border-amber-500/30 text-amber-500 flex items-center justify-center mx-auto mb-3">
                    <svg className="w-6 h-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
                    </svg>
                  </div>
                  <h4 className="text-sm font-bold text-zinc-900 dark:text-zinc-100 mb-1">
                    Google Drive Permission Required
                  </h4>
                  <p className="text-xs text-zinc-600 dark:text-zinc-400 mb-4 max-w-md mx-auto leading-relaxed">
                    Aapka account (<strong>{googleAccount?.email}</strong>) connected hai, lekin purane session me Google Drive read access grant nahi hua tha. Is wajah se aapki existing Google Sheets list nahi ho pa rahi hain.
                  </p>
                  <button
                    onClick={() => handleConnectGoogle("consent")}
                    className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-bold transition shadow-xs cursor-pointer inline-flex items-center gap-2"
                  >
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75m-3-7.036A11.959 11.959 0 013.598 6 11.99 11.99 0 003 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285z" />
                    </svg>
                    <span>Grant Drive Permission (1-Click)</span>
                  </button>
                </div>
              ) : loadingDriveSheets ? (
                <div className="py-12 flex flex-col items-center justify-center text-zinc-400">
                  <div className="w-6 h-6 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin mb-2" />
                  <span className="text-xs font-medium">Fetching Google Sheets from your account...</span>
                </div>
              ) : driveSheets.length === 0 ? (
                <div className="py-12 text-center bg-zinc-50 dark:bg-zinc-800/30 rounded-2xl border border-dashed border-zinc-200 dark:border-zinc-800 p-6">
                  <div className="w-12 h-12 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-500 flex items-center justify-center mx-auto mb-3">
                    <svg className="w-6 h-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
                    </svg>
                  </div>
                  <h4 className="text-sm font-bold text-zinc-800 dark:text-zinc-200 mb-1">
                    No Spreadsheets Found
                  </h4>
                  <p className="text-xs text-zinc-500 dark:text-zinc-400 mb-4 max-w-sm mx-auto">
                    Create a spreadsheet on Google Sheets under this account, then click Refresh.
                  </p>
                  <div className="flex items-center justify-center gap-2">
                    <button
                      onClick={() => fetchDriveSheets()}
                      className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-bold transition shadow-xs cursor-pointer inline-flex items-center gap-1.5"
                    >
                      <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0l3.181 3.183a8.25 8.25 0 0013.803-3.7M4.031 9.865a8.25 8.25 0 0113.803-3.7l3.181 3.182" />
                      </svg>
                      <span>Refresh List</span>
                    </button>
                    <button
                      onClick={() => handleConnectGoogle("consent")}
                      className="px-4 py-2 bg-zinc-200 dark:bg-zinc-800 hover:bg-zinc-300 dark:hover:bg-zinc-700 text-zinc-800 dark:text-zinc-200 rounded-xl text-xs font-semibold transition cursor-pointer"
                    >
                      Re-authorize Google
                    </button>
                  </div>
                </div>
              ) : (
                <div className="space-y-3">
                  {/* Search filter */}
                  <div className="relative">
                    <input
                      type="text"
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      placeholder="Search your spreadsheets..."
                      className="w-full pl-9 pr-4 py-2 bg-slate-50 dark:bg-zinc-800/40 border border-zinc-200 dark:border-zinc-700/80 rounded-xl text-xs text-zinc-900 dark:text-zinc-100 placeholder-zinc-400 focus:outline-none focus:ring-2 focus:ring-emerald-500/30"
                    />
                    <svg className="w-4 h-4 text-zinc-400 absolute left-3 top-2.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z" />
                    </svg>
                    {searchQuery && (
                      <button
                        onClick={() => setSearchQuery("")}
                        className="absolute right-3 top-2.5 text-zinc-400 hover:text-zinc-600 text-xs"
                      >
                        ✕
                      </button>
                    )}
                  </div>

                  {/* List */}
                  <div className="space-y-2 max-h-72 overflow-y-auto pr-1">
                    {filteredDriveSheets.map((sheet) => {
                      const linkedItem = links.find((l) => l.spreadsheetId === sheet.id);
                      const isCurrentlyLinking = linking && linkingSheetId === sheet.id;

                      return (
                        <div
                          key={sheet.id}
                          className="p-3.5 rounded-2xl bg-white dark:bg-zinc-800/40 border border-zinc-200 dark:border-zinc-700/70 hover:border-emerald-500/50 dark:hover:border-emerald-500/40 transition flex items-center justify-between gap-3 shadow-xs"
                        >
                          <div className="flex items-center gap-3 min-w-0">
                            <div className="w-8 h-8 rounded-xl bg-emerald-50 dark:bg-emerald-950/50 border border-emerald-200/80 dark:border-emerald-800/60 flex items-center justify-center shrink-0">
                              <svg className="w-4 h-4 text-emerald-600 dark:text-emerald-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                                <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
                              </svg>
                            </div>
                            <div className="min-w-0">
                              <p className="text-xs font-bold text-zinc-900 dark:text-zinc-100 truncate">
                                {sheet.name}
                              </p>
                              {sheet.modifiedTime && (
                                <p className="text-[10px] text-zinc-500 dark:text-zinc-400 mt-0.5">
                                  Last modified: {new Date(sheet.modifiedTime).toLocaleDateString()}
                                </p>
                              )}
                            </div>
                          </div>

                          <div className="flex items-center gap-2 shrink-0">
                            <a
                              href={`https://docs.google.com/spreadsheets/d/${sheet.id}/edit`}
                              target="_blank"
                              rel="noreferrer"
                              className="p-2 text-zinc-400 hover:text-emerald-600 dark:hover:text-emerald-400 hover:bg-zinc-100 dark:hover:bg-zinc-700/60 rounded-xl transition cursor-pointer"
                              title="Open in Google Sheets"
                            >
                              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 6H5.25A2.25 2.25 0 003 8.25v10.5A2.25 2.25 0 005.25 21h10.5A2.25 2.25 0 0018 18.75V10.5m-10.5 6L21 3m0 0h-5.25M21 3v5.25" />
                              </svg>
                            </a>

                            {linkedItem ? (
                              <button
                                onClick={() => {
                                  if (linkedItem.fileId && onOpenFile) {
                                    onOpenFile(linkedItem.fileId);
                                    onClose();
                                  } else {
                                    setActiveTab("connected");
                                  }
                                }}
                                className="px-3.5 py-1.5 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-xs font-bold transition shadow-xs cursor-pointer flex items-center gap-1.5"
                              >
                                <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                  <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5L21 12m0 0l-7.5 7.5M21 12H3" />
                                </svg>
                                <span>Open Sheet</span>
                              </button>
                            ) : (
                              <button
                                onClick={() =>
                                  handleLink(
                                    `https://docs.google.com/spreadsheets/d/${sheet.id}/edit`,
                                    true,
                                    sheet.id
                                  )
                                }
                                disabled={linking}
                                className="px-3.5 py-1.5 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white rounded-xl text-xs font-bold transition shadow-xs cursor-pointer flex items-center gap-1.5"
                              >
                                {isCurrentlyLinking ? (
                                  <>
                                    <div className="w-3 h-3 border-2 border-white/40 border-t-white rounded-full animate-spin" />
                                    <span>Linking...</span>
                                  </>
                                ) : (
                                  <>
                                    <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                      <path strokeLinecap="round" strokeLinejoin="round" d="M13.19 8.688a4.5 4.5 0 011.242 7.244l-4.5 4.5a4.5 4.5 0 01-6.364-6.364l1.757-1.757m13.35-.622l1.757-1.757a4.5 4.5 0 00-6.364-6.364l-4.5 4.5a4.5 4.5 0 001.242 7.244" />
                                    </svg>
                                    <span>Link &amp; Open</span>
                                  </>
                                )}
                              </button>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* TAB 2: Connected Sheets (in Workspace) */}
          {activeTab === "connected" && (
            <div className="space-y-3">
              {loading ? (
                <div className="py-12 flex flex-col items-center justify-center text-zinc-400">
                  <div className="w-6 h-6 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin mb-2" />
                  <span className="text-xs">Loading linked spreadsheets...</span>
                </div>
              ) : links.length === 0 ? (
                <div className="py-12 text-center bg-zinc-50 dark:bg-zinc-800/30 rounded-2xl border border-dashed border-zinc-200 dark:border-zinc-800 p-6">
                  <div className="w-12 h-12 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-500 flex items-center justify-center mx-auto mb-3">
                    <svg className="w-6 h-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
                    </svg>
                  </div>
                  <h4 className="text-sm font-bold text-zinc-800 dark:text-zinc-200 mb-1">
                    No Google Sheets Linked Yet
                  </h4>
                  <p className="text-xs text-zinc-500 dark:text-zinc-400 mb-4 max-w-sm mx-auto">
                    Select a Google Sheet from your account to automatically sync leads in real-time.
                  </p>
                  <button
                    onClick={() => setActiveTab("drive")}
                    className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-bold transition shadow-sm cursor-pointer inline-flex items-center gap-1.5"
                  >
                    <span>View Your Google Sheets</span>
                  </button>
                </div>
              ) : (
                <div className="space-y-3">
                  {links.map((link) => {
                    const isSyncing = syncingLinkId === link.id;
                    return (
                      <div
                        key={link.id}
                        className="p-4 rounded-2xl bg-white dark:bg-zinc-800/40 border border-zinc-200 dark:border-zinc-700/70 shadow-xs space-y-3 hover:border-zinc-300 dark:hover:border-zinc-600 transition"
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div className="flex items-start gap-3 min-w-0">
                            <div className="w-9 h-9 rounded-xl bg-emerald-50 dark:bg-emerald-950/50 border border-emerald-200/80 dark:border-emerald-800/60 flex items-center justify-center shrink-0 mt-0.5">
                              <svg className="w-5 h-5 text-emerald-600 dark:text-emerald-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                                <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
                              </svg>
                            </div>
                            <div className="min-w-0">
                              <div className="flex items-center gap-2">
                                <h4 className="text-sm font-bold text-zinc-900 dark:text-zinc-100 truncate">
                                  {link.spreadsheetName || "Connected Google Sheet"}
                                </h4>
                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 shrink-0">
                                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                                  Active
                                </span>
                              </div>
                              <p className="text-[11px] text-zinc-500 dark:text-zinc-400 mt-0.5">
                                Tab: <span className="font-mono text-zinc-700 dark:text-zinc-300 font-semibold">{link.sheetName || "Sheet1"}</span>
                                {link.lastSyncedAt && (
                                  <span className="ml-2 text-zinc-400 dark:text-zinc-500">
                                    • Last synced: {new Date(link.lastSyncedAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                                  </span>
                                )}
                              </p>
                            </div>
                          </div>

                          <a
                            href={link.sheetUrl}
                            target="_blank"
                            rel="noreferrer"
                            className="p-2 text-zinc-400 hover:text-emerald-600 dark:hover:text-emerald-400 hover:bg-zinc-100 dark:hover:bg-zinc-700/60 rounded-xl transition shrink-0 cursor-pointer"
                            title="Open external spreadsheet in Google Sheets"
                          >
                            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                              <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 6H5.25A2.25 2.25 0 003 8.25v10.5A2.25 2.25 0 005.25 21h10.5A2.25 2.25 0 0018 18.75V10.5m-10.5 6L21 3m0 0h-5.25M21 3v5.25" />
                            </svg>
                          </a>
                        </div>

                        <div className="pt-2 border-t border-zinc-100 dark:border-zinc-700/50 flex items-center gap-2">
                          {onOpenFile && link.fileId && (
                            <button
                              onClick={() => {
                                if (link.fileId) {
                                  onOpenFile(link.fileId);
                                  onClose();
                                }
                              }}
                              className="flex-1 py-2 px-3 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 shadow-xs transition cursor-pointer"
                            >
                              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6A2.25 2.25 0 016 3.75h2.25A2.25 2.25 0 0110.5 6v2.25a2.25 2.25 0 01-2.25 2.25H6a2.25 2.25 0 01-2.25-2.25V6zM3.75 15.75A2.25 2.25 0 016 13.5h2.25a2.25 2.25 0 012.25 2.25V18a2.25 2.25 0 01-2.25 2.25H6A2.25 2.25 0 013.75 18v-2.25zM13.5 6a2.25 2.25 0 012.25-2.25H18A2.25 2.25 0 0120.25 6v2.25A2.25 2.25 0 0118 10.5h-2.25a2.25 2.25 0 01-2.25-2.25V6zM13.5 15.75a2.25 2.25 0 012.25-2.25H18a2.25 2.25 0 012.25 2.25V18A2.25 2.25 0 0118 20.25h-2.25A2.25 2.25 0 0113.5 18v-2.25z" />
                              </svg>
                              <span>Open Sheet</span>
                            </button>
                          )}

                          <button
                            onClick={() => handleManualSync(link)}
                            disabled={isSyncing}
                            className="py-2 px-3.5 bg-zinc-100 dark:bg-zinc-700/70 hover:bg-zinc-200 dark:hover:bg-zinc-700 text-zinc-800 dark:text-zinc-200 disabled:opacity-50 rounded-xl text-xs font-semibold flex items-center justify-center gap-1.5 transition cursor-pointer"
                          >
                            <svg className={`w-3.5 h-3.5 ${isSyncing ? "animate-spin text-emerald-500" : ""}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                              <path strokeLinecap="round" strokeLinejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0l3.181 3.183a8.25 8.25 0 0013.803-3.7M4.031 9.865a8.25 8.25 0 0113.803-3.7l3.181 3.182" />
                            </svg>
                            <span>{isSyncing ? "Syncing..." : "Sync"}</span>
                          </button>

                          <button
                            onClick={() => setUnlinkingLink(link)}
                            className="py-2 px-3 text-zinc-400 hover:text-rose-600 dark:hover:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/40 rounded-xl text-xs font-semibold flex items-center gap-1 transition cursor-pointer"
                            title="Disconnect this Google Sheet"
                          >
                            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                              <path strokeLinecap="round" strokeLinejoin="round" d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0" />
                            </svg>
                            <span>Disconnect</span>
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* TAB 3: Custom URL */}
          {activeTab === "manual" && (
            <div className="space-y-4">
              <div className="p-4 rounded-2xl bg-zinc-50 dark:bg-zinc-800/30 border border-zinc-200 dark:border-zinc-800 space-y-3">
                <label className="block text-xs font-bold text-zinc-800 dark:text-zinc-200">
                  Paste Google Sheet URL or Spreadsheet ID
                </label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={sheetUrl}
                    onChange={(e) => setSheetUrl(e.target.value)}
                    placeholder="https://docs.google.com/spreadsheets/d/1BxiMVs.../edit"
                    className="flex-1 px-3.5 py-2.5 bg-white dark:bg-zinc-900 border border-zinc-300 dark:border-zinc-700 rounded-xl text-xs text-zinc-900 dark:text-zinc-100 placeholder-zinc-400 focus:outline-none focus:ring-2 focus:ring-emerald-500/40"
                  />
                  <button
                    onClick={() => handleLink(undefined, true)}
                    disabled={linking || !sheetUrl.trim()}
                    className="px-4 py-2.5 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 transition cursor-pointer shrink-0 shadow-xs"
                  >
                    {linking ? (
                      <>
                        <div className="w-3.5 h-3.5 border-2 border-white/40 border-t-white rounded-full animate-spin" />
                        <span>Connecting...</span>
                      </>
                    ) : (
                      <>
                        <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M13.19 8.688a4.5 4.5 0 011.242 7.244l-4.5 4.5a4.5 4.5 0 01-6.364-6.364l1.757-1.757m13.35-.622l1.757-1.757a4.5 4.5 0 00-6.364-6.364l-4.5 4.5a4.5 4.5 0 001.242 7.244" />
                        </svg>
                        <span>Connect &amp; Open</span>
                      </>
                    )}
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="px-6 py-3.5 border-t border-zinc-200 dark:border-zinc-800 bg-zinc-50/70 dark:bg-zinc-900/60 flex items-center justify-between">
          <span className="text-[11px] text-zinc-400">
            {links.length} connected {links.length === 1 ? "sheet" : "sheets"}
          </span>
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-xl text-xs font-semibold text-zinc-700 dark:text-zinc-300 hover:bg-zinc-200 dark:hover:bg-zinc-800 transition cursor-pointer"
          >
            Close
          </button>
        </div>
      </div>

      {/* Theme-based Disconnect Confirmation Dialog */}
      <ConfirmModal
        isOpen={Boolean(unlinkingLink)}
        title={`Disconnect "${unlinkingLink?.spreadsheetName || "Google Sheet"}"`}
        message={`Are you sure you want to disconnect "${unlinkingLink?.spreadsheetName || "this Google Sheet"}"? Leads already imported into My Manager will remain safe in your workspace.`}
        confirmText="Disconnect Sheet"
        confirmVariant="danger"
        isLoading={isUnlinking}
        onConfirm={executeUnlink}
        onClose={() => setUnlinkingLink(null)}
      />
    </div>
  );
}
