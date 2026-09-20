"use client";

import { Suspense, useCallback, useEffect, useState } from "react";
import { useLeadsStore } from "./hooks/useLeadsStore";
import BreadcrumbBar from "./components/BreadcrumbBar";
import Toolbar from "./components/Toolbar";
import TabBar from "./components/TabBar";
import SpreadsheetGrid from "./components/SpreadsheetGrid";
import FolderGrid from "./components/FolderGrid";
import FileList from "./components/FileList";
import CreateFolderModal from "./components/modals/CreateFolderModal";
import CreateFileModal from "./components/modals/CreateFileModal";
import CreateTabModal from "./components/modals/CreateTabModal";
import CreateColumnModal from "./components/modals/CreateColumnModal";
import EditFolderModal from "./components/modals/EditFolderModal";
import EditFileModal from "./components/modals/EditFileModal";
import EditTabModal from "./components/modals/EditTabModal";
import ImportModal from "./components/modals/ImportModal";
import LinkGoogleSheetModal from "./components/modals/LinkGoogleSheetModal";
import MoveFileModal from "./components/modals/MoveFileModal";
import ConfirmModal from "./components/modals/ConfirmModal";
import type { LeadFile } from "./types";

export default function LeadsPage() {
  return (
    <Suspense fallback={
      <div className="flex items-center justify-center h-full">
        <div className="w-6 h-6 border-2 border-zinc-600 border-t-zinc-300 rounded-full animate-spin" />
      </div>
    }>
      <LeadsPageInner />
    </Suspense>
  );
}

function LeadsPageInner() {
  const store = useLeadsStore();
  const [showGoogleSheetModal, setShowGoogleSheetModal] = useState(false);
  const [movingFile, setMovingFile] = useState<LeadFile | null>(null);
  const [linkedSheets, setLinkedSheets] = useState<Array<{
    id: string;
    spreadsheetId: string;
    spreadsheetName: string | null;
    sheetName: string | null;
    sheetUrl: string;
    syncStatus: string;
    lastSyncedAt: string | null;
    fileId?: string | null;
    file?: {
      id: string;
      name: string;
      description?: string | null;
      folderId?: string | null;
      folder?: { id: string; name: string; color?: string | null } | null;
      tabs: Array<{ id: string; name: string; _count: { leads: number } }>;
    } | null;
  }>>([]);

  const fetchLinkedSheets = useCallback(async () => {
    try {
      const res = await fetch("/api/admin/leads/google-sheets");
      const data = await res.json();
      if (res.ok && data.links) {
        setLinkedSheets(data.links);
      }
    } catch {
      // Non-blocking
    }
  }, []);

  useEffect(() => {
    fetchLinkedSheets();
    const handleRefresh = () => fetchLinkedSheets();
    window.addEventListener("leads-tree-refresh", handleRefresh);
    return () => window.removeEventListener("leads-tree-refresh", handleRefresh);
  }, [fetchLinkedSheets, store.refreshKey]);

  const hasExpandedFile = !!store.expandedFile;

  const handleMoveFile = useCallback(async (fileId: string, folderId: string | null) => {
    try {
      const res = await fetch(`/api/admin/leads/files/${fileId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ folderId }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || "Failed to move file");
      }
      store.setToast({ type: "success", message: "File moved successfully" });
      store.loadTree();
      window.dispatchEvent(new Event("leads-tree-refresh"));
    } catch (err: any) {
      store.setToast({ type: "error", message: err?.message || "Failed to move file" });
    }
  }, [store]);

  const handleDeleteLeads = useCallback(async (ids: string[]) => {
    store.setLeads((prev) => prev.filter((l) => !ids.includes(l.id)));
    let deleted = 0;
    let failed = 0;
    let lastError = "";
    for (const id of ids) {
      try {
        const res = await fetch(`/api/admin/leads/${id}`, { method: "DELETE" });
        if (res.ok) {
          deleted++;
        } else {
          const body = await res.json().catch(() => ({}));
          lastError = body.error || `HTTP ${res.status}`;
          console.error("[delete leads]", id, lastError);
          failed++;
        }
      } catch (e) {
        lastError = e instanceof Error ? e.message : "Network error";
        console.error("[delete leads]", id, lastError);
        failed++;
      }
    }
    if (failed > 0) {
      store.setToast({ type: "error", message: `Deleted ${deleted}, failed ${failed}${lastError ? ": " + lastError : ""}` });
      store.setRefreshKey((k) => k + 1);
    } else {
      store.setToast({ type: "success", message: `Deleted ${deleted} row${deleted > 1 ? "s" : ""}` });
    }
  }, [store]);

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {store.toast && (
        <div
          className={`fixed bottom-6 right-6 z-[100] px-4 py-3 rounded-xl text-sm font-semibold shadow-2xl flex items-center gap-2.5 animate-in slide-in-from-bottom-3 fade-in duration-200 ${
            store.toast.type === "success"
              ? "bg-emerald-600 text-white border border-emerald-500"
              : "bg-red-600 text-white border border-red-500"
          }`}
        >
          {store.toast.type === "success" ? (
            <svg className="w-4 h-4 text-white shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
            </svg>
          ) : (
            <svg className="w-4 h-4 text-white shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z" />
            </svg>
          )}
          <span>{store.toast.message}</span>
        </div>
      )}

      <div className="flex-1 flex flex-col overflow-hidden">
        {hasExpandedFile ? (
          <>
            <Toolbar
              search={store.search}
              onSearchChange={store.setSearch}
              statusFilter={store.statusFilter}
              onStatusFilterChange={store.setStatusFilter}
              categoryFilter={store.categoryFilter}
              onCategoryFilterChange={store.setCategoryFilter}
              categories={store.categories}
              columns={store.columns}
              leads={store.rawLeads || store.leads}
              columnFilters={store.columnFilters}
              onColumnFilterChange={store.handleColumnFilterChange}
              hasExpandedFile={hasExpandedFile}
              expandedFile={store.expandedFile}
              onCloseExpandedFile={store.collapseFile}
              loading={store.loading}
              syncStatus={store.syncStatus}
              onRefresh={() => store.setRefreshKey((k) => k + 1)}
              onImport={() => store.setShowImportModal(true)}
              onExport={store.handleExport}
              onOpenGoogleSheets={() => setShowGoogleSheetModal(true)}
              googleSheetUrl={store.googleSheetUrl}
              canWrite={store.canWrite}
            />

            <div className="flex-1 min-h-0 overflow-hidden flex flex-col p-0 bg-white dark:bg-[#09090b]">
              <div className="flex-1 flex flex-col min-h-0 w-full overflow-hidden">
                <SpreadsheetGrid
                  leads={store.leads}
                  columns={store.columns}
                  canWrite={store.canWrite}
                  onCellEdit={store.saveCellEdit}
                  onDeleteLead={store.handleDeleteLead}
                  onDeleteLeads={handleDeleteLeads}
                  onDuplicateLead={store.handleDuplicateLead}
                  onSelectLead={store.setSelectedLead}
                  onEditLead={store.setEditingLead}
                  onLeadUpdated={(updated) => store.setLeads((prev) => prev.map((l) => (l.id === updated.id ? updated : l)))}
                  onRenameColumn={store.handleRenameColumn}
                  onDeleteColumn={store.handleDeleteColumn}
                  onRefresh={() => store.setRefreshKey((k) => k + 1)}
                  onAddRow={store.handleAddLead}
                  onAddColumn={() => store.setShowCreateColumn(true)}
                  sortField={store.sortField}
                  sortOrder={store.sortOrder}
                  onSort={store.handleSort}
                  syncStatus={store.syncStatus}
                  loading={store.loading}
                  sheetName={store.selectedTab?.name || store.expandedFile?.name || "Sheet"}
                  tabId={store.selectedTab?.id}
                  fileId={store.expandedFile?.id}
                  initialStyling={store.selectedTab?.mergedCells as Record<string, unknown> | undefined}
                />
              </div>

              <TabBar
                tabs={store.expandedFile!.tabs}
                selectedTab={store.selectedTab}
                onSelectTab={store.selectTab}
                canWrite={store.canWrite}
                onCreateTab={() => store.setShowCreateTab(true)}
                onDuplicateTab={store.handleDuplicateTab}
                onEditTab={(tab) => {
                  store.setExpandedFile((prev) => prev ? { ...prev, tabs: prev.tabs.map((t) => t.id === tab.id ? tab : t) } : null);
                  if (store.selectedTab?.id === tab.id) store.setSelectedTab(tab);
                }}
                onDeleteTab={store.promptDeleteTab}
              />
            </div>
          </>
        ) : (
          <div className="flex-1 min-h-0 overflow-auto p-4 sm:p-6 lg:p-8 space-y-6">
            {/* 1. Page Header */}
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 pb-2 border-b border-zinc-200 dark:border-zinc-800">
              <div>
                {store.folderPath.length > 0 ? (
                  <div>
                    <div className="flex items-center gap-2 text-xs text-zinc-500 dark:text-zinc-400 mb-1">
                      <button
                        onClick={store.navigateToRoot}
                        className="hover:text-zinc-900 dark:hover:text-white transition cursor-pointer font-medium"
                      >
                        Leads
                      </button>
                      {store.folderPath.map((folder, index) => (
                        <span key={folder.id} className="flex items-center gap-2">
                          <span className="text-zinc-400 dark:text-zinc-600">/</span>
                          {index === store.folderPath.length - 1 ? (
                            <span className="text-zinc-900 dark:text-white font-medium">{folder.name}</span>
                          ) : (
                            <button
                              onClick={() => store.navigateToFolder(folder)}
                              className="hover:text-zinc-900 dark:hover:text-white transition cursor-pointer font-medium"
                            >
                              {folder.name}
                            </button>
                          )}
                        </span>
                      ))}
                    </div>
                    <h1 className="text-xl font-bold tracking-tight text-zinc-900 dark:text-white">
                      {store.folderPath[store.folderPath.length - 1]?.name || "Spreadsheets"}
                    </h1>
                  </div>
                ) : (
                  <div>
                    <h1 className="text-xl font-bold tracking-tight text-zinc-900 dark:text-white">Spreadsheets</h1>
                    <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5">
                      Organize folders, spreadsheet files, and manage records in real time
                    </p>
                  </div>
                )}
              </div>

              <div className="flex items-center gap-2.5 w-full sm:w-auto justify-end">
                <button
                  onClick={() => store.setRefreshKey((k) => k + 1)}
                  disabled={store.loading}
                  className="px-3.5 py-2 text-xs font-semibold text-zinc-700 dark:text-zinc-300 bg-white dark:bg-zinc-900 hover:bg-slate-50 dark:hover:bg-zinc-800 border border-zinc-200 dark:border-zinc-800 rounded-xl transition flex items-center gap-1.5 shadow-sm cursor-pointer disabled:opacity-60"
                  title="Refresh Folders & Files"
                >
                  <svg className={`w-3.5 h-3.5 ${store.loading ? "animate-spin" : ""}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0l3.181 3.183a8.25 8.25 0 0013.803-3.7M4.031 9.865a8.25 8.25 0 0113.803-3.7l3.181 3.182" />
                  </svg>
                  <span>Refresh</span>
                </button>

                {store.canWrite && (
                  <>
                    <button
                      onClick={() => setShowGoogleSheetModal(true)}
                      className="px-3.5 py-2 text-xs font-semibold text-emerald-700 dark:text-emerald-300 bg-emerald-50/80 dark:bg-emerald-950/40 hover:bg-emerald-100 dark:hover:bg-emerald-900/50 border border-emerald-200/80 dark:border-emerald-800/60 rounded-xl transition flex items-center gap-1.5 shadow-xs cursor-pointer"
                      title="Link Google Sheet"
                    >
                      <svg className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
                      </svg>
                      <span>Google Sheet</span>
                    </button>
                    <button
                      onClick={() => store.setShowCreateFolder(true)}
                      className="px-3.5 py-2 text-xs font-semibold text-zinc-700 dark:text-zinc-300 bg-white dark:bg-zinc-900 hover:bg-slate-50 dark:hover:bg-zinc-800 border border-zinc-200 dark:border-zinc-800 rounded-xl transition flex items-center gap-1.5 shadow-sm cursor-pointer"
                    >
                      <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
                      </svg>
                      <span>New Folder</span>
                    </button>
                    <button
                      onClick={() => store.setShowCreateFile(true)}
                      className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-xs font-bold transition flex items-center gap-1.5 shadow-sm cursor-pointer"
                    >
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
                      </svg>
                      <span>New File</span>
                    </button>
                  </>
                )}
              </div>
            </div>

            {/* 2. Summary KPI Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              {/* Total Folders */}
              <div className="p-5 bg-white dark:bg-[#111114] border border-zinc-200 dark:border-zinc-800 rounded-2xl shadow-xs flex flex-col justify-between">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-zinc-500 dark:text-zinc-400">Total Folders</span>
                  <span className="p-1.5 rounded-lg bg-blue-50 dark:bg-blue-950/40 text-blue-600 dark:text-blue-400">
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 12.75V12A2.25 2.25 0 014.5 9.75h15A2.25 2.25 0 0121.75 12v.75m-8.69-6.44l-2.12-2.12a1.5 1.5 0 00-1.061-.44H4.5A2.25 2.25 0 002.25 6v12a2.25 2.25 0 002.25 2.25h15A2.25 2.25 0 0021.75 18V9a2.25 2.25 0 00-2.25-2.25h-5.379a1.5 1.5 0 01-1.06-.44z" />
                    </svg>
                  </span>
                </div>
                <div className="mt-3">
                  <p className="text-2xl font-bold text-zinc-900 dark:text-white">{store.folderItems.length}</p>
                  <p className="text-[11px] text-zinc-500 dark:text-zinc-400 font-medium mt-1">directories</p>
                </div>
              </div>

              {/* Lead Spreadsheets */}
              <div className="p-5 bg-white dark:bg-[#111114] border border-zinc-200 dark:border-zinc-800 rounded-2xl shadow-xs flex flex-col justify-between">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-zinc-500 dark:text-zinc-400">Lead Spreadsheets</span>
                  <span className="p-1.5 rounded-lg bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400">
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
                    </svg>
                  </span>
                </div>
                <div className="mt-3">
                  <p className="text-2xl font-bold text-zinc-900 dark:text-white">{store.fileItems.length}</p>
                  <p className="text-[11px] text-emerald-600 dark:text-emerald-400 font-semibold mt-1">active files</p>
                </div>
              </div>

              {/* Sync Pipeline */}
              <div className="p-5 bg-white dark:bg-[#111114] border border-zinc-200 dark:border-zinc-800 rounded-2xl shadow-xs flex flex-col justify-between">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-zinc-500 dark:text-zinc-400">Sync Pipeline</span>
                  <span className="p-1.5 rounded-lg bg-purple-50 dark:bg-purple-950/40 text-purple-600 dark:text-purple-400">
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0l3.181 3.183a8.25 8.25 0 0013.803-3.7M4.031 9.865a8.25 8.25 0 0113.803-3.7l3.181 3.182" />
                    </svg>
                  </span>
                </div>
                <div className="mt-3">
                  <p className="text-2xl font-bold text-zinc-900 dark:text-white">Live</p>
                  <p className="text-[11px] text-purple-600 dark:text-purple-400 font-semibold mt-1">● Real-time sync</p>
                </div>
              </div>

              {/* Permission Mode */}
              <div className="p-5 bg-white dark:bg-[#111114] border border-zinc-200 dark:border-zinc-800 rounded-2xl shadow-xs flex flex-col justify-between">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-zinc-500 dark:text-zinc-400">Permission Mode</span>
                  <span className="p-1.5 rounded-lg bg-amber-50 dark:bg-amber-950/40 text-amber-600 dark:text-amber-400">
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75m-3-7.036A11.959 11.959 0 013.598 6 11.99 11.99 0 003 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285z" />
                    </svg>
                  </span>
                </div>
                <div className="mt-3">
                  <p className="text-2xl font-bold text-zinc-900 dark:text-white">{store.canWrite ? "Read & Write" : "Read Only"}</p>
                  <p className="text-[11px] text-amber-600 dark:text-amber-400 font-semibold mt-1">workspace access</p>
                </div>
              </div>
            </div>

            {/* 3. Search Bar */}
            <div className="relative w-full">
              <svg className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-400 dark:text-zinc-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z" />
              </svg>
              <input
                type="text"
                placeholder="Search folders and files by name..."
                value={store.search}
                onChange={(e) => store.setSearch(e.target.value)}
                className="w-full bg-white dark:bg-[#111114] border border-zinc-200 dark:border-zinc-800 rounded-xl pl-10 pr-4 py-2.5 text-sm text-zinc-900 dark:text-zinc-300 placeholder:text-zinc-400 dark:placeholder:text-zinc-600 focus:outline-none focus:ring-2 focus:ring-blue-500/20 dark:focus:ring-zinc-700 hover:border-zinc-300 dark:hover:border-zinc-700 transition shadow-xs"
              />
            </div>

            {/* Linked Google Sheets Quick Access (Shown on root level) */}
            {linkedSheets.length > 0 && store.folderPath.length === 0 && (
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="w-6 h-6 rounded-lg bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 flex items-center justify-center">
                      <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
                      </svg>
                    </div>
                    <h2 className="text-xs font-bold text-zinc-900 dark:text-white uppercase tracking-wider">
                      Linked Google Sheets
                    </h2>
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800/60">
                      {linkedSheets.length} active
                    </span>
                  </div>
                  <span className="text-[11px] text-zinc-500 dark:text-zinc-400">
                    Live 2-way sync • Moveable to any folder
                  </span>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3.5">
                  {linkedSheets.map((link) => {
                    const file = link.file;
                    const folderName = file?.folder?.name || (file?.folderId ? "Folder" : "Root");
                    const totalLeads = file?.tabs ? file.tabs.reduce((sum, tab) => sum + tab._count.leads, 0) : 0;
                    const tabCount = file?.tabs?.length || 1;

                    return (
                      <div
                        key={link.id}
                        className="p-4 rounded-2xl bg-white dark:bg-[#111114] border border-emerald-200/80 dark:border-emerald-900/40 hover:border-emerald-500/50 dark:hover:border-emerald-500/40 shadow-xs hover:shadow-md transition-all flex flex-col justify-between gap-3.5 group"
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div className="flex items-start gap-3 min-w-0">
                            <div className="w-10 h-10 rounded-xl bg-emerald-50 dark:bg-emerald-950/50 border border-emerald-200 dark:border-emerald-800/60 flex items-center justify-center shrink-0 mt-0.5 text-emerald-600 dark:text-emerald-400 group-hover:scale-105 transition-transform">
                              <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                                <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
                              </svg>
                            </div>
                            <div className="min-w-0">
                              <h3
                                onClick={() => file && store.openFileById(file.id)}
                                className="text-sm font-bold text-zinc-900 dark:text-white truncate cursor-pointer hover:text-blue-600 dark:hover:text-blue-400 transition"
                                title="Click to open spreadsheet"
                              >
                                {link.spreadsheetName || file?.name || "Connected Sheet"}
                              </h3>

                              <div className="flex items-center gap-1.5 mt-1 flex-wrap">
                                {/* Folder location tag */}
                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-semibold bg-slate-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 border border-zinc-200 dark:border-zinc-700/60">
                                  <svg className="w-3 h-3 text-amber-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 12.75V12A2.25 2.25 0 014.5 9.75h15A2.25 2.25 0 0121.75 12v.75m-8.69-6.44l-2.12-2.12a1.5 1.5 0 00-1.061-.44H4.5A2.25 2.25 0 002.25 6v12a2.25 2.25 0 002.25 2.25h15A2.25 2.25 0 0021.75 18V9a2.25 2.25 0 00-2.25-2.25h-5.379a1.5 1.5 0 01-1.06-.44z" />
                                  </svg>
                                  <span>{file?.folder ? `In: ${file.folder.name}` : "In: Root"}</span>
                                </span>

                                {/* Live Sync Badge */}
                                <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md text-[10px] font-semibold bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800/60">
                                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                                  Live Sync
                                </span>

                                <span className="text-[11px] text-zinc-500 dark:text-zinc-400">
                                  {tabCount} {tabCount === 1 ? "tab" : "tabs"} • {totalLeads} rows
                                </span>
                              </div>
                            </div>
                          </div>

                          {/* External Google Sheets Link */}
                          <a
                            href={link.sheetUrl}
                            target="_blank"
                            rel="noreferrer"
                            className="p-1.5 text-zinc-400 hover:text-emerald-600 dark:hover:text-emerald-400 hover:bg-slate-100 dark:hover:bg-zinc-800 rounded-lg transition cursor-pointer shrink-0"
                            title="Open in Google Sheets (external)"
                          >
                            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                              <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 6H5.25A2.25 2.25 0 003 8.25v10.5A2.25 2.25 0 005.25 21h10.5A2.25 2.25 0 0018 18.75V10.5m-10.5 6L21 3m0 0h-5.25M21 3v5.25" />
                            </svg>
                          </a>
                        </div>

                        {/* Action buttons */}
                        <div className="pt-2.5 border-t border-zinc-100 dark:border-zinc-800/80 flex items-center justify-between gap-2">
                          <div className="flex items-center gap-2">
                            {file && (
                              <button
                                onClick={() => store.openFileById(file.id)}
                                className="px-3.5 py-1.5 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-xs font-bold transition shadow-xs cursor-pointer flex items-center gap-1.5 active:scale-97"
                              >
                                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                  <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5L21 12m0 0l-7.5 7.5M21 12H3" />
                                </svg>
                                <span>Open</span>
                              </button>
                            )}

                            {store.canWrite && file && (
                              <button
                                onClick={() => setMovingFile(file as LeadFile)}
                                className="px-3 py-1.5 text-zinc-700 dark:text-zinc-300 hover:text-zinc-900 dark:hover:text-white bg-slate-100 dark:bg-zinc-800 hover:bg-slate-200 dark:hover:bg-zinc-700 border border-zinc-200 dark:border-zinc-700/70 rounded-xl text-xs font-semibold transition cursor-pointer flex items-center gap-1.5 shadow-2xs"
                                title="Move this spreadsheet to another folder"
                              >
                                <svg className="w-3.5 h-3.5 text-zinc-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                  <path strokeLinecap="round" strokeLinejoin="round" d="M7.5 7.5h-.75A2.25 2.25 0 004.5 9.75v7.5a2.25 2.25 0 002.25 2.25h7.5a2.25 2.25 0 002.25 2.25h1.5m-6-6l6-6m0 0v5.25m0-5.25H11.25" />
                                </svg>
                                <span>Move to Folder</span>
                              </button>
                            )}
                          </div>

                          <button
                            onClick={() => setShowGoogleSheetModal(true)}
                            className="text-[11px] font-medium text-zinc-500 hover:text-emerald-600 dark:text-zinc-400 dark:hover:text-emerald-400 transition cursor-pointer flex items-center gap-1"
                          >
                            <span>Settings</span>
                            <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                              <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
                            </svg>
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* 4. Empty State or Contents */}
            {store.folderItems.length === 0 && store.fileItems.length === 0 && linkedSheets.length === 0 && (
              <div className="flex flex-col items-center justify-center py-20 bg-white dark:bg-[#111114] rounded-2xl border border-zinc-200 dark:border-zinc-800 shadow-xs">
                <div className="w-16 h-16 rounded-2xl bg-zinc-100 dark:bg-zinc-800/60 border border-zinc-200 dark:border-zinc-700/60 text-zinc-400 dark:text-zinc-500 flex items-center justify-center mb-4">
                  <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 12.75V12A2.25 2.25 0 014.5 9.75h15A2.25 2.25 0 0121.75 12v.75m-8.69-6.44l-2.12-2.12a1.5 1.5 0 00-1.061-.44H4.5A2.25 2.25 0 002.25 6v12a2.25 2.25 0 002.25 2.25h15A2.25 2.25 0 0021.75 18V9a2.25 2.25 0 00-2.25-2.25h-5.379a1.5 1.5 0 01-1.06-.44z" />
                  </svg>
                </div>
                <p className="text-zinc-900 dark:text-zinc-100 font-semibold text-sm mb-1">No files or folders yet</p>
                <p className="text-zinc-500 dark:text-zinc-400 text-xs mb-5">Create a folder or spreadsheet file to organize your lead pipeline.</p>
                {store.canWrite && (
                  <div className="flex items-center gap-2.5">
                    <button
                      onClick={() => store.setShowCreateFolder(true)}
                      className="px-3.5 py-2 text-xs font-semibold text-zinc-700 dark:text-zinc-300 bg-white dark:bg-zinc-900 hover:bg-slate-50 dark:hover:bg-zinc-800 border border-zinc-200 dark:border-zinc-800 rounded-xl transition flex items-center gap-1.5 shadow-sm cursor-pointer"
                    >
                      <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
                      </svg>
                      <span>New Folder</span>
                    </button>
                    <button
                      onClick={() => store.setShowCreateFile(true)}
                      className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-xs font-bold transition flex items-center gap-1.5 shadow-sm cursor-pointer"
                    >
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
                      </svg>
                      <span>New File</span>
                    </button>
                  </div>
                )}
              </div>
            )}

            <FolderGrid
              folders={store.folderItems}
              onNavigate={store.navigateToFolder}
              onEdit={store.canWrite ? store.setEditingFolder : undefined}
              onDelete={store.canWrite ? store.promptDeleteFolder : undefined}
              onDropFile={store.canWrite ? handleMoveFile : undefined}
              deleting={store.deleting}
            />

            <FileList
              files={store.fileItems}
              onClick={store.expandFile}
              onEdit={store.canWrite ? store.setEditingFile : undefined}
              onMove={store.canWrite ? (file) => setMovingFile(file) : undefined}
              onDelete={store.canWrite ? store.promptDeleteFile : undefined}
              deleting={store.deleting}
            />
          </div>
        )}
      </div>

      {/* Modals */}
      {store.showCreateFolder && (
        <CreateFolderModal
          parentId={store.currentFolder?.id}
          folders={store.folders}
          onClose={() => store.setShowCreateFolder(false)}
          onSuccess={() => { store.setShowCreateFolder(false); store.loadTree(); window.dispatchEvent(new Event("leads-tree-refresh")); store.setToast({ type: "success", message: "Folder created" }); }}
        />
      )}
      {store.showCreateFile && (
        <CreateFileModal
          folderId={store.currentFolder?.id}
          folders={store.folders}
          onClose={() => store.setShowCreateFile(false)}
          onSuccess={(file) => { store.setShowCreateFile(false); store.loadTree(); window.dispatchEvent(new Event("leads-tree-refresh")); store.expandFile(file); store.setToast({ type: "success", message: "File created" }); }}
        />
      )}
      {store.showCreateTab && store.expandedFile && (
        <CreateTabModal
          fileId={store.expandedFile.id}
          onClose={() => store.setShowCreateTab(false)}
          onSuccess={(tab) => {
            store.setShowCreateTab(false);
            store.setExpandedFile((prev) => prev ? { ...prev, tabs: [...prev.tabs, tab] } : null);
            store.selectTab(tab);
            window.dispatchEvent(new Event("leads-tree-refresh"));
            store.setToast({ type: "success", message: "Tab created" });
          }}
        />
      )}
      {store.editingFolder && (
        <EditFolderModal
          folder={store.editingFolder}
          folders={store.folders}
          onClose={() => store.setEditingFolder(null)}
          onSuccess={() => { store.setEditingFolder(null); store.loadTree(); window.dispatchEvent(new Event("leads-tree-refresh")); store.setToast({ type: "success", message: "Folder updated" }); }}
        />
      )}
      {store.editingFile && (
        <EditFileModal
          file={store.editingFile}
          onClose={() => store.setEditingFile(null)}
          onSuccess={(updated) => { store.setEditingFile(null); store.loadTree(); window.dispatchEvent(new Event("leads-tree-refresh")); if (store.expandedFile?.id === updated.id) store.setExpandedFile((prev) => prev ? { ...prev, name: updated.name, description: updated.description } : null); store.setToast({ type: "success", message: "File updated" }); }}
        />
      )}
      {store.editingTab && (
        <EditTabModal
          tab={store.editingTab}
          onClose={() => store.setEditingTab(null)}
          onSuccess={(updated) => { store.setEditingTab(null); if (store.expandedFile) store.expandFile(store.expandedFile); if (store.selectedTab?.id === updated.id) store.setSelectedTab((prev) => prev ? { ...prev, name: updated.name } : null); window.dispatchEvent(new Event("leads-tree-refresh")); store.setToast({ type: "success", message: "Tab updated" }); }}
        />
      )}

      {store.showImportModal && store.selectedTab && (
        <ImportModal
          tabId={store.selectedTab.id}
          tabName={store.selectedTab.name}
          fileName={store.expandedFile?.name || ""}
          onClose={() => store.setShowImportModal(false)}
          onSuccess={(count) => { store.setShowImportModal(false); store.setToast({ type: "success", message: `Imported ${count} leads` }); store.setRefreshKey((k) => k + 1); store.refreshFile(); }}
        />
      )}
      {store.showCreateColumn && store.expandedFile && (
        <CreateColumnModal
          fileId={store.expandedFile.id}
          onClose={() => store.setShowCreateColumn(false)}
          onSuccess={(col) => {
            store.setShowCreateColumn(false);
            store.setColumns((prev) => [...prev, col].sort((a, b) => a.sortOrder - b.sortOrder));
            store.setToast({ type: "success", message: "Column added" });
          }}
        />
      )}

      {/* Move File Modal */}
      {movingFile && (
        <MoveFileModal
          file={movingFile}
          folders={store.folders}
          onClose={() => setMovingFile(null)}
          onSuccess={() => {
            setMovingFile(null);
            store.loadTree();
            window.dispatchEvent(new Event("leads-tree-refresh"));
            store.setToast({ type: "success", message: "File moved successfully" });
          }}
        />
      )}

      {/* Confirmation Modal */}
      <ConfirmModal
        isOpen={store.confirmDialog.isOpen}
        title={store.confirmDialog.title}
        message={store.confirmDialog.message}
        confirmText={store.confirmDialog.confirmText}
        confirmVariant={store.confirmDialog.confirmVariant}
        onConfirm={async () => {
          await store.confirmDialog.onConfirm();
          store.closeConfirm();
        }}
        onClose={store.closeConfirm}
      />

      {/* Google Sheets Live 2-Way Sync Modal */}
      <LinkGoogleSheetModal
        isOpen={showGoogleSheetModal}
        onClose={() => setShowGoogleSheetModal(false)}
        tabId={store.selectedTab?.id}
        fileId={store.expandedFile?.id}
        onOpenFile={(fId) => {
          store.openFileById(fId);
        }}
        onSyncComplete={() => {
          store.setRefreshKey((k) => k + 1);
          store.loadTree();
        }}
      />
    </div>
  );
}
