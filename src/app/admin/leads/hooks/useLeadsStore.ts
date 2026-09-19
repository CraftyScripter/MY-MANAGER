import { useState, useEffect, useCallback, useRef, useMemo } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import type { LeadFolder, LeadFile, LeadTab, LeadColumn, Lead, Toast } from "../types";
import { hasWritePermission } from "@/lib/permissions";

export type SyncStatus = "idle" | "saving" | "saved" | "error";

function findFolderAndPath(
  items: LeadFolder[],
  targetId: string,
  currentPath: LeadFolder[] = []
): { folder: LeadFolder; path: LeadFolder[] } | null {
  for (const item of items) {
    const path = [...currentPath, item];
    if (item.id === targetId) {
      return { folder: item, path };
    }
    if (item.children && item.children.length > 0) {
      const found = findFolderAndPath(item.children, targetId, path);
      if (found) return found;
    }
  }
  return null;
}

export function useLeadsStore() {
  const searchParams = useSearchParams();
  const router = useRouter();

  const [folders, setFolders] = useState<LeadFolder[]>([]);
  const [rootFiles, setRootFiles] = useState<LeadFile[]>([]);
  const [currentFolder, setCurrentFolder] = useState<LeadFolder | null>(null);
  const [folderPath, setFolderPath] = useState<LeadFolder[]>([]);
  const [expandedFile, setExpandedFile] = useState<LeadFile | null>(null);
  const [columns, setColumns] = useState<LeadColumn[]>([]);
  const [selectedTab, setSelectedTab] = useState<LeadTab | null>(null);
  const [leads, setLeads] = useState<Lead[]>([]);
  const [categories, setCategories] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [initialLoading, setInitialLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [columnFilters, setColumnFilters] = useState<Record<string, string>>({});
  const [refreshKey, setRefreshKey] = useState(0);
  const [toast, setToast] = useState<Toast | null>(null);

  const [sortField, setSortField] = useState<string | null>(null);
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("asc");
  const [syncStatus, setSyncStatus] = useState<SyncStatus>("idle");
  const [googleSheetUrl, setGoogleSheetUrl] = useState<string | null>(null);

  const [showCreateFolder, setShowCreateFolder] = useState(false);
  const [showCreateFile, setShowCreateFile] = useState(false);
  const [showCreateTab, setShowCreateTab] = useState(false);
  const [showCreateColumn, setShowCreateColumn] = useState(false);
  const [editingFolder, setEditingFolder] = useState<LeadFolder | null>(null);
  const [editingFile, setEditingFile] = useState<LeadFile | null>(null);
  const [editingTab, setEditingTab] = useState<LeadTab | null>(null);
  const [editingLead, setEditingLead] = useState<Lead | null>(null);
  const [selectedLead, setSelectedLead] = useState<Lead | null>(null);
  const [showImportModal, setShowImportModal] = useState(false);
  const [deleting, setDeleting] = useState<string | null>(null);

  const [canWrite, setCanWrite] = useState(true);
  const [userRole, setUserRole] = useState<string>("member");

  useEffect(() => {
    const fetchUser = () => {
      fetch("/api/admin/auth/me")
        .then((r) => r.json())
        .then((data) => {
          if (data.user) {
            setUserRole(data.user.role || "member");
            if (data.user.role === "admin") {
              setCanWrite(true);
            } else {
              setCanWrite(hasWritePermission(data.user.permissions, "leads"));
            }
          }
        })
        .catch(() => {});
    };

    fetchUser();

    window.addEventListener("auth-user-updated", fetchUser);

    let bc: BroadcastChannel | null = null;
    try {
      bc = new BroadcastChannel("pm_auth_sync");
      bc.onmessage = () => fetchUser();
    } catch {}

    const handleStorage = (e: StorageEvent) => {
      if (e.key === "pm_auth_sync") fetchUser();
    };
    window.addEventListener("storage", handleStorage);

    const interval = setInterval(fetchUser, 30000);

    return () => {
      window.removeEventListener("auth-user-updated", fetchUser);
      window.removeEventListener("storage", handleStorage);
      clearInterval(interval);
      if (bc) bc.close();
    };
  }, []);

  const syncTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handleColumnFilterChange = useCallback((colKey: string, value: string) => {
    setColumnFilters((prev) => {
      const next = { ...prev };
      if (!value || value === "all") {
        delete next[colKey];
      } else {
        next[colKey] = value;
      }
      return next;
    });
  }, []);

  const sortedLeads = useMemo(() => {
    let result = leads;

    // Apply column filters
    const activeFilters = Object.entries(columnFilters).filter(([, val]) => val && val !== "all");
    if (activeFilters.length > 0) {
      result = result.filter((lead) => {
        const custom = (lead.customFields as Record<string, string>) || {};
        return activeFilters.every(([key, filterVal]) => {
          const actualVal = custom[key] ?? (lead as unknown as Record<string, string>)?.[key] ?? "";
          return String(actualVal).toLowerCase() === String(filterVal).toLowerCase();
        });
      });
    }

    if (!sortField) return result;
    return [...result].sort((a, b) => {
      if (sortField === "rating" || sortField === "reviews") {
        const aVal = a[sortField];
        const bVal = b[sortField];
        if (aVal == null && bVal == null) return 0;
        if (aVal == null) return 1;
        if (bVal == null) return -1;
        return sortOrder === "asc" ? (aVal as number) - (bVal as number) : (bVal as number) - (aVal as number);
      }
      const aCustom = (a.customFields as Record<string, string>) || {};
      const bCustom = (b.customFields as Record<string, string>) || {};
      let aVal: string;
      let bVal: string;
      switch (sortField) {
        case "businessName": aVal = a.businessName || ""; bVal = b.businessName || ""; break;
        case "phone": aVal = a.phone || ""; bVal = b.phone || ""; break;
        case "email": aVal = a.email || ""; bVal = b.email || ""; break;
        case "category": aVal = a.category || ""; bVal = b.category || ""; break;
        case "status": aVal = a.status || ""; bVal = b.status || ""; break;
        default: aVal = aCustom[sortField] ?? ""; bVal = bCustom[sortField] ?? ""; break;
      }
      const cmp = aVal.localeCompare(bVal);
      return sortOrder === "asc" ? cmp : -cmp;
    });
  }, [leads, columnFilters, sortField, sortOrder]);


  function handleSort(field: string) {
    if (sortField === field) {
      if (sortOrder === "asc") {
        setSortOrder("desc");
      } else {
        setSortField(null);
        setSortOrder("asc");
      }
    } else {
      setSortField(field);
      setSortOrder("asc");
    }
  }

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 4000);
    return () => clearTimeout(t);
  }, [toast]);

  useEffect(() => {
    const t = setTimeout(() => { setDebouncedSearch(search); }, 300);
    return () => clearTimeout(t);
  }, [search]);

  const loadTree = useCallback(async () => {
    try {
      const fileId = searchParams.get("fileId");
      const folderId = searchParams.get("folderId");
      const tabId = searchParams.get("tabId");

      const treeRes = await fetch("/api/admin/leads/folders");
      const treeData = await treeRes.json();
      const treeFolders: LeadFolder[] = treeData.folders || [];
      setFolders(treeFolders);

      if (fileId) {
        const fileRes = await fetch(`/api/admin/leads/files/${fileId}`);
        const fileData = await fileRes.json();
        if (fileData.file) {
          setExpandedFile(fileData.file);
          setColumns(fileData.file.columns || []);
          if (tabId) {
            const tab = fileData.file.tabs.find((t: LeadTab) => t.id === tabId);
            if (tab) setSelectedTab(tab);
            else if (fileData.file.tabs.length > 0) setSelectedTab(fileData.file.tabs[0]);
          } else if (fileData.file.tabs.length > 0) {
            setSelectedTab(fileData.file.tabs[0]);
          }
          if (fileData.file.folderId) {
            const found = findFolderAndPath(treeFolders, fileData.file.folderId);
            if (found) {
              setFolderPath(found.path);
              setCurrentFolder(found.folder);
            } else {
              setFolderPath([]);
              setCurrentFolder(null);
            }
          } else {
            setFolderPath([]);
            setCurrentFolder(null);
          }
        }
      } else if (folderId) {
        setExpandedFile(null);
        setSelectedTab(null);
        setLeads([]);
        setColumns([]);
        const found = findFolderAndPath(treeFolders, folderId);
        if (found) {
          setCurrentFolder(found.folder);
          setFolderPath(found.path);
        } else {
          setCurrentFolder(null);
          setFolderPath([]);
        }
        const filesRes = await fetch(`/api/admin/leads/files?folderId=${folderId}`);
        const filesData = await filesRes.json();
        setRootFiles(filesData.files || []);
      } else {
        setCurrentFolder(null);
        setFolderPath([]);
        setExpandedFile(null);
        setSelectedTab(null);
        setLeads([]);
        setColumns([]);
        setRootFiles(treeData.rootFiles || []);
      }
    } catch {
      setToast({ type: "error", message: "Failed to load leads data" });
    } finally {
      setInitialLoading(false);
    }
  }, [searchParams, refreshKey]);

  useEffect(() => {
    loadTree();
    const handleRefresh = () => {
      loadTree();
    };
    const handleFocus = () => {
      loadTree();
    };
    const handleVisibility = () => {
      if (document.visibilityState === "visible") loadTree();
    };

    window.addEventListener("leads-tree-refresh", handleRefresh);
    window.addEventListener("focus", handleFocus);
    document.addEventListener("visibilitychange", handleVisibility);

    return () => {
      window.removeEventListener("leads-tree-refresh", handleRefresh);
      window.removeEventListener("focus", handleFocus);
      document.removeEventListener("visibilitychange", handleVisibility);
    };
  }, [loadTree]);

  useEffect(() => {
    if (!expandedFile || !selectedTab) return;
    let cancelled = false;
    // Only show full loading spinner when initial leads are empty
    setLoading((prev) => (leads.length === 0 ? true : false));
    const params = new URLSearchParams();
    params.set("tabId", selectedTab.id);
    if (debouncedSearch) params.set("search", debouncedSearch);
    if (statusFilter !== "all") params.set("status", statusFilter);
    if (categoryFilter !== "all") params.set("category", categoryFilter);
    params.set("limit", "500");
    fetch(`/api/admin/leads?${params}`)
      .then((r) => r.json())
      .then((data) => {
        if (!cancelled) {
          setLeads(data.leads || []);
          setCategories(data.categories || []);
        }
      })
      .catch(() => {
        if (!cancelled) setToast({ type: "error", message: "Failed to load leads" });
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => { cancelled = true; };
  }, [expandedFile?.id, selectedTab?.id, debouncedSearch, statusFilter, categoryFilter, refreshKey]);

  useEffect(() => {
    if (!expandedFile?.id) {
      setGoogleSheetUrl(null);
      return;
    }
    fetch(`/api/admin/leads/google-sheets?fileId=${expandedFile.id}`)
      .then((r) => r.json())
      .then((data) => {
        if (data.activeLink && data.activeLink.fileId === expandedFile.id && data.activeLink.sheetUrl) {
          setGoogleSheetUrl(data.activeLink.sheetUrl);
        } else {
          setGoogleSheetUrl(null);
        }
      })
      .catch(() => setGoogleSheetUrl(null));
  }, [expandedFile?.id, refreshKey]);

  // Real-time live collaboration sync (Google Sheets style)
  useEffect(() => {
    if (typeof window === "undefined") return;

    let es: EventSource | null = null;
    let bcTab: BroadcastChannel | null = null;
    let bcFile: BroadcastChannel | null = null;
    let bcGlobal: BroadcastChannel | null = null;

    // Helper to apply incoming cell edit to state
    const handleIncomingCellEdit = (leadId: string, colKey?: string, val?: string | unknown, lead?: Lead) => {
      setLeads((prev) =>
        prev.map((l) => {
          if (l.id !== leadId) return l;
          if (lead) return lead;
          if (!colKey) return l;
          const strVal = val !== undefined && val !== null ? String(val) : "";
          const custom = { ...((l.customFields as Record<string, string>) || {}) };
          if (strVal) {
            custom[colKey] = strVal;
          } else {
            delete custom[colKey];
          }
          return {
            ...l,
            [colKey]: strVal || null,
            customFields: Object.keys(custom).length > 0 ? custom : null,
          };
        })
      );
    };

    // 1. Cross-tab instant local channel for global workspace events (file / folder deletions / creations)
    try {
      bcGlobal = new BroadcastChannel("pm_leads_global_workspace");
      bcGlobal.onmessage = (event) => {
        const msg = event.data;
        if (!msg) return;
        if (msg.type === "file_deleted") {
          if (expandedFile?.id === msg.fileId) {
            collapseFile();
            setToast({ type: "error", message: "This file has been deleted by an administrator" });
          }
          setRootFiles((prev) => prev.filter((f) => f.id !== msg.fileId));
          loadTree();
        } else if (
          msg.type === "file_created" ||
          msg.type === "file_updated" ||
          msg.type === "folder_created" ||
          msg.type === "folder_deleted" ||
          msg.type === "folder_updated" ||
          msg.type === "explorer_refresh"
        ) {
          loadTree();
        }
      };
    } catch {}

    // 2. Cross-tab instant local channel for current sheet tab
    if (selectedTab?.id) {
      try {
        bcTab = new BroadcastChannel(`pm_sheet_rows_${selectedTab.id}`);
        bcTab.onmessage = (event) => {
          const msg = event.data;
          if (!msg) return;
          if (msg.type === "cell_edit") {
            handleIncomingCellEdit(msg.leadId, msg.columnKey, msg.value, msg.lead);
          } else if (msg.type === "lead_added" && msg.lead) {
            setLeads((prev) => (prev.some((l) => l.id === msg.lead.id) ? prev : [...prev, msg.lead]));
          } else if (msg.type === "lead_deleted" && msg.leadId) {
            setLeads((prev) => prev.filter((l) => l.id !== msg.leadId));
          }
        };
      } catch {}
    }

    // 3. Cross-tab instant local channel for current file (columns, tabs, imports)
    if (expandedFile?.id) {
      try {
        bcFile = new BroadcastChannel(`pm_sheet_file_${expandedFile.id}`);
        bcFile.onmessage = (event) => {
          const msg = event.data;
          if (!msg) return;
          if (msg.type === "columns_changed" || msg.type === "tabs_changed" || msg.type === "leads_imported" || msg.type === "file_updated") {
            refreshFile();
            setRefreshKey((k) => k + 1);
          } else if (msg.type === "file_deleted") {
            if (expandedFile?.id === msg.fileId) {
              collapseFile();
              setToast({ type: "error", message: "This file has been deleted by an administrator" });
            }
            loadTree();
          }
        };
      } catch {}
    }

    // 4. Remote Server-Sent Events (SSE) for instant cross-device/user live collaboration
    try {
      let syncUrl = "/api/admin/leads/sync";
      if (selectedTab?.id && expandedFile?.id) {
        syncUrl = `/api/admin/leads/sync?tabId=${selectedTab.id}&fileId=${expandedFile.id}`;
      } else if (selectedTab?.id) {
        syncUrl = `/api/admin/leads/sync?tabId=${selectedTab.id}`;
      } else if (expandedFile?.id) {
        syncUrl = `/api/admin/leads/sync?fileId=${expandedFile.id}`;
      }

      es = new EventSource(syncUrl);
      es.onmessage = (e) => {
        try {
          const parsed = JSON.parse(e.data);
          const type = parsed.type;
          const data = parsed.data || parsed;

          if (type === "cell_edit" && data) {
            handleIncomingCellEdit(data.leadId, data.columnKey, data.value, data.lead);
          } else if (type === "lead_added" && data?.lead) {
            const newLead = data.lead as Lead;
            setLeads((prev) => (prev.some((l) => l.id === newLead.id) ? prev : [...prev, newLead]));
          } else if (type === "lead_deleted" && data?.leadId) {
            const delId = data.leadId as string;
            setLeads((prev) => prev.filter((l) => l.id !== delId));
          } else if (type === "file_deleted" && data?.fileId) {
            const delFileId = data.fileId as string;
            setRootFiles((prev) => prev.filter((f) => f.id !== delFileId));
            if (expandedFile?.id === delFileId) {
              collapseFile();
              setToast({ type: "error", message: "This file has been deleted by an administrator" });
            }
            loadTree();
          } else if (
            type === "file_created" ||
            type === "file_updated" ||
            type === "folder_created" ||
            type === "folder_deleted" ||
            type === "folder_updated" ||
            type === "explorer_refresh"
          ) {
            loadTree();
          } else if (
            type === "columns_changed" ||
            type === "tabs_changed" ||
            type === "leads_imported"
          ) {
            refreshFile();
            setRefreshKey((k) => k + 1);
          }
        } catch {}
      };
    } catch (err) {
      console.error("SSE sync init error:", err);
    }

    return () => {
      if (bcGlobal) bcGlobal.close();
      if (bcTab) bcTab.close();
      if (bcFile) bcFile.close();
      if (es) es.close();
    };
  }, [selectedTab?.id, expandedFile?.id, loadTree]);


  function navigateToFolder(folder: LeadFolder | null) {
    const params = new URLSearchParams(searchParams.toString());
    if (folder) {
      params.set("folderId", folder.id);
      params.delete("fileId");
      params.delete("tabId");
    } else {
      params.delete("folderId");
      params.delete("fileId");
      params.delete("tabId");
    }
    router.push(`/admin/leads?${params.toString()}`);
  }

  function navigateToRoot() {
    router.push("/admin/leads");
  }

  async function expandFile(file: LeadFile) {
    const params = new URLSearchParams(searchParams.toString());
    params.set("fileId", file.id);
    params.delete("tabId");
    router.push(`/admin/leads?${params.toString()}`);
  }

  function openFileById(fileId: string) {
    const params = new URLSearchParams(searchParams.toString());
    params.set("fileId", fileId);
    params.delete("tabId");
    router.push(`/admin/leads?${params.toString()}`);
  }

  function collapseFile() {
    const params = new URLSearchParams(searchParams.toString());
    params.delete("fileId");
    params.delete("tabId");
    router.push(`/admin/leads?${params.toString()}`);
  }

  function selectTab(tab: LeadTab) {
    const params = new URLSearchParams(searchParams.toString());
    params.set("tabId", tab.id);
    router.push(`/admin/leads?${params.toString()}`);
  }

  const [confirmDialog, setConfirmDialog] = useState<{
    isOpen: boolean;
    title: string;
    message: string;
    confirmText?: string;
    confirmVariant?: "danger" | "warning" | "primary";
    onConfirm: () => void | Promise<void>;
  }>({
    isOpen: false,
    title: "",
    message: "",
    confirmText: "Delete",
    confirmVariant: "danger",
    onConfirm: () => {},
  });

  function requestConfirm(options: {
    title: string;
    message: string;
    confirmText?: string;
    confirmVariant?: "danger" | "warning" | "primary";
    onConfirm: () => void | Promise<void>;
  }) {
    setConfirmDialog({
      isOpen: true,
      title: options.title,
      message: options.message,
      confirmText: options.confirmText || "Delete",
      confirmVariant: options.confirmVariant || "danger",
      onConfirm: options.onConfirm,
    });
  }

  function closeConfirm() {
    setConfirmDialog((prev) => ({ ...prev, isOpen: false }));
  }

  async function handleDeleteFolder(id: string) {
    setDeleting(id);
    try {
      const res = await fetch(`/api/admin/leads/folders/${id}`, { method: "DELETE" });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || `HTTP ${res.status}`);
      }
      setToast({ type: "success", message: "Folder deleted" });
      if (currentFolder?.id === id) {
        const parentFolder = folderPath.length > 1 ? folderPath[folderPath.length - 2] : null;
        navigateToFolder(parentFolder);
      } else {
        await loadTree();
      }
      try {
        const bc = new BroadcastChannel("pm_leads_global_workspace");
        bc.postMessage({ type: "folder_deleted", folderId: id });
        bc.close();
      } catch {}
      window.dispatchEvent(new Event("leads-tree-refresh"));
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Failed to delete folder";
      console.error("[delete folder]", msg);
      setToast({ type: "error", message: msg });
    } finally {
      setDeleting(null);
    }
  }

  function promptDeleteFolder(folder: { id: string; name: string }) {
    requestConfirm({
      title: `Delete Folder "${folder.name}"`,
      message: "Are you sure you want to delete this folder and all its contents? This action cannot be undone.",
      confirmText: "Delete Folder",
      confirmVariant: "danger",
      onConfirm: () => handleDeleteFolder(folder.id),
    });
  }

  async function handleDeleteFile(id: string) {
    setDeleting(id);
    try {
      const res = await fetch(`/api/admin/leads/files/${id}`, { method: "DELETE" });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || `HTTP ${res.status}`);
      }
      setToast({ type: "success", message: "File deleted" });
      setRootFiles((prev) => prev.filter((f) => f.id !== id));
      if (expandedFile?.id === id) collapseFile();
      try {
        const bc = new BroadcastChannel("pm_leads_global_workspace");
        bc.postMessage({ type: "file_deleted", fileId: id });
        bc.close();
      } catch {}
      window.dispatchEvent(new Event("leads-tree-refresh"));
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Failed to delete file";
      console.error("[delete file]", msg);
      setToast({ type: "error", message: msg });
    } finally {
      setDeleting(null);
    }
  }

  function promptDeleteFile(file: { id: string; name: string }) {
    requestConfirm({
      title: `Delete File "${file.name}"`,
      message: "Are you sure you want to delete this file and all its sheets and leads? This action cannot be undone.",
      confirmText: "Delete File",
      confirmVariant: "danger",
      onConfirm: () => handleDeleteFile(file.id),
    });
  }

  async function handleDeleteTab(id: string) {
    setDeleting(id);
    try {
      const res = await fetch(`/api/admin/leads/tabs/${id}`, { method: "DELETE" });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed");
      }
      setToast({ type: "success", message: "Tab deleted" });
      setExpandedFile((prev) => prev ? { ...prev, tabs: prev.tabs.filter((t) => t.id !== id) } : null);
      if (selectedTab?.id === id && expandedFile) {
        expandFile(expandedFile);
      }
      window.dispatchEvent(new Event("leads-tree-refresh"));
    } catch (e) {
      setToast({ type: "error", message: e instanceof Error ? e.message : "Failed" });
    } finally {
      setDeleting(null);
    }
  }

  function promptDeleteTab(tab: { id: string; name: string }) {
    requestConfirm({
      title: `Delete Sheet "${tab.name}"`,
      message: "Are you sure you want to delete this sheet tab and all its leads? This action cannot be undone.",
      confirmText: "Delete Sheet",
      confirmVariant: "danger",
      onConfirm: () => handleDeleteTab(tab.id),
    });
  }

  async function handleDeleteLead(id: string) {
    setDeleting(id);
    setLeads((prev) => prev.filter((l) => l.id !== id));
    if (typeof window !== "undefined" && selectedTab) {
      try {
        const bc = new BroadcastChannel(`pm_sheet_rows_${selectedTab.id}`);
        bc.postMessage({ type: "lead_deleted", leadId: id });
        bc.close();
      } catch {}
    }
    try {
      const res = await fetch(`/api/admin/leads/${id}`, { method: "DELETE" });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || `HTTP ${res.status}`);
      }
      setToast({ type: "success", message: "Lead deleted" });
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Failed to delete lead";
      console.error("[delete lead]", msg);
      setToast({ type: "error", message: msg });
      setRefreshKey((k) => k + 1);
    } finally {
      setDeleting(null);
    }
  }

  async function saveCellEdit(leadId: string, columnKey: string, value: string) {
    const matchedCol = columns.find((c) => c.name.toLowerCase().trim() === columnKey.toLowerCase().trim());
    const isCustom = Boolean(matchedCol);
    const resolvedKey = matchedCol ? matchedCol.name : columnKey;

    setSyncStatus("saving");
    if (syncTimerRef.current) clearTimeout(syncTimerRef.current);

    // 1. Optimistically update local state immediately
    setLeads((prev) =>
      prev.map((l) => {
        if (l.id !== leadId) return l;
        if (isCustom) {
          const newCustomFields = { ...(l.customFields || {}) };
          if (value) {
            newCustomFields[resolvedKey] = value;
          } else {
            delete newCustomFields[resolvedKey];
          }
          return { ...l, customFields: Object.keys(newCustomFields).length > 0 ? newCustomFields : null };
        }
        return {
          ...l,
          [resolvedKey]: value || null,
          [resolvedKey.toLowerCase()]: value || null,
        };
      })
    );

    // 2. Broadcast locally across open browser tabs for 0ms latency
    if (typeof window !== "undefined" && selectedTab) {
      try {
        const bc = new BroadcastChannel(`pm_sheet_rows_${selectedTab.id}`);
        bc.postMessage({ type: "cell_edit", leadId, columnKey: resolvedKey, value });
        bc.close();
      } catch {}
    }

    // 3. Persist and broadcast remotely via SSE
    try {
      const body: Record<string, unknown> = isCustom
        ? { customField: { columnName: resolvedKey, value: value || null } }
        : { [resolvedKey]: value || null };

      const res = await fetch(`/api/admin/leads/${leadId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      if (!res.ok) throw new Error("Failed");

      setSyncStatus("saved");
      syncTimerRef.current = setTimeout(() => setSyncStatus("idle"), 3000);
    } catch {
      setSyncStatus("error");
      setToast({ type: "error", message: "Failed to save edit" });
      syncTimerRef.current = setTimeout(() => setSyncStatus("idle"), 5000);
    }
  }

  async function handleSaveLead(lead: Lead) {
    try {
      const res = await fetch(`/api/admin/leads/${lead.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(lead),
      });
      if (!res.ok) throw new Error("Failed");
      setToast({ type: "success", message: "Lead updated" });
      setEditingLead(null);
      setRefreshKey((k) => k + 1);
    } catch {
      setToast({ type: "error", message: "Failed to update lead" });
    }
  }

  async function handleRenameColumn(colId: string, newName: string) {
    try {
      const res = await fetch(`/api/admin/leads/columns/${colId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: newName }),
      });
      if (!res.ok) throw new Error("Failed to rename column");
      setColumns((prev) => prev.map((c) => c.id === colId ? { ...c, name: newName } : c));
      setExpandedFile((prev) =>
        prev
          ? {
              ...prev,
              columns: (prev.columns || []).map((c) =>
                c.id === colId ? { ...c, name: newName } : c
              ),
            }
          : null
      );
      refreshFile();
      setToast({ type: "success", message: "Column renamed" });
    } catch {
      setToast({ type: "error", message: "Failed to rename column" });
    }
  }

  async function handleDeleteColumn(colId: string) {
    try {
      const targetCol = columns.find((c) => c.id === colId);
      const colName = targetCol?.name;

      const res = await fetch(`/api/admin/leads/columns/${colId}`, { method: "DELETE" });
      if (!res.ok && res.status !== 404) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || `HTTP ${res.status}`);
      }

      // Filter out from local columns state and expandedFile columns
      setColumns((prev) =>
        prev.filter((c) => c.id !== colId && (!colName || c.name.toLowerCase().trim() !== colName.toLowerCase().trim()))
      );
      setExpandedFile((prev) =>
        prev
          ? {
              ...prev,
              columns: (prev.columns || []).filter(
                (c) => c.id !== colId && (!colName || c.name.toLowerCase().trim() !== colName.toLowerCase().trim())
              ),
            }
          : null
      );

      // Clean up column data from in-memory leads state
      if (colName) {
        const lowerName = colName.toLowerCase().trim();
        setLeads((prev) =>
          prev.map((lead) => {
            const custom = { ...((lead.customFields as Record<string, string>) || {}) };
            let changed = false;
            for (const k of Object.keys(custom)) {
              if (k.toLowerCase().trim() === lowerName || k === colName) {
                delete custom[k];
                changed = true;
              }
            }
            if (!changed) return lead;
            return {
              ...lead,
              customFields: Object.keys(custom).length > 0 ? custom : null,
            };
          })
        );
      }

      setRefreshKey((k) => k + 1);
      refreshFile();
      setToast({ type: "success", message: "Column deleted" });
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Failed to delete column";
      console.error("[delete column]", msg);
      setToast({ type: "error", message: msg });
    }
  }

  async function handleMergeColumns(sourceColumnNames: string[], newColumnName: string, separator: string = " ") {
    if (!expandedFile) return;
    try {
      const res = await fetch("/api/admin/leads/columns/merge", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          fileId: expandedFile.id,
          sourceColumnNames,
          newColumnName,
          separator,
        }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || "Failed to merge columns");
      }
      setToast({ type: "success", message: `Merged ${sourceColumnNames.length} columns into "${newColumnName}"` });
      refreshFile();
      setRefreshKey((k) => k + 1);
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Failed to merge columns";
      setToast({ type: "error", message: msg });
      throw e;
    }
  }

  async function handleAddLead() {
    if (!selectedTab) return;
    try {
      const res = await fetch("/api/admin/leads", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tabId: selectedTab.id, businessName: "", status: "" }),
      });
      if (!res.ok) throw new Error("Failed");
      const data = await res.json();
      if (data.lead) {
        setLeads((prev) => (prev.some((l) => l.id === data.lead.id) ? prev : [...prev, data.lead]));
        if (typeof window !== "undefined") {
          try {
            const bc = new BroadcastChannel(`pm_sheet_rows_${selectedTab.id}`);
            bc.postMessage({ type: "lead_added", lead: data.lead });
            bc.close();
          } catch {}
        }
      }
    } catch {
      setToast({ type: "error", message: "Failed to add row" });
    }
  }


  async function handleDuplicateLead(lead: Lead) {
    if (!selectedTab) return;
    try {
      const res = await fetch("/api/admin/leads", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          tabId: selectedTab.id,
          businessName: lead.businessName ? `${lead.businessName} (Copy)` : "",
          phone: lead.phone,
          email: lead.email,
          address: lead.address,
          website: lead.website,
          category: lead.category,
          rating: lead.rating,
          reviews: lead.reviews,
          sourceUrl: lead.sourceUrl,
          status: lead.status,
          notes: lead.notes,
          customFields: lead.customFields,
        }),
      });
      if (!res.ok) throw new Error("Failed");
      const data = await res.json();
      if (data.lead) {
        setLeads((prev) => [...prev, data.lead]);
        if (typeof window !== "undefined") {
          try {
            const bc = new BroadcastChannel(`pm_sheet_rows_${selectedTab.id}`);
            bc.postMessage({ type: "lead_added", lead: data.lead });
            bc.close();
          } catch {}
        }
      }
      setToast({ type: "success", message: "Row duplicated" });
    } catch {
      setToast({ type: "error", message: "Failed to duplicate row" });
    }
  }

  async function handleDuplicateTab(tabId: string) {
    if (!expandedFile) return;
    const sourceTab = expandedFile.tabs.find((t) => t.id === tabId);
    if (!sourceTab) return;
    try {
      const res = await fetch("/api/admin/leads/tabs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          fileId: expandedFile.id,
          name: `${sourceTab.name} (Copy)`,
          sourceTabId: tabId,
        }),
      });
      if (!res.ok) throw new Error("Failed");
      const data = await res.json();
      setExpandedFile((prev) => (prev ? { ...prev, tabs: [...prev.tabs, data.tab] } : null));
      selectTab(data.tab);
      window.dispatchEvent(new Event("leads-tree-refresh"));
      setToast({ type: "success", message: "Sheet duplicated" });
    } catch {
      setToast({ type: "error", message: "Failed to duplicate sheet" });
    }
  }

  function refreshFile() {
    if (!expandedFile) return;
    fetch(`/api/admin/leads/files/${expandedFile.id}`)
      .then((r) => r.json())
      .then((data) => {
        if (data.file) {
          setExpandedFile(data.file);
          setColumns(data.file.columns || []);
          if (selectedTab) {
            const updatedTab = data.file.tabs.find((t: LeadTab) => t.id === selectedTab.id);
            if (updatedTab) setSelectedTab(updatedTab);
          }
        }
      })
      .catch(() => {});
  }

  function handleExport() {
    if (!selectedTab) return;
    const params = new URLSearchParams();
    params.set("tabId", selectedTab.id);
    if (statusFilter !== "all") params.set("status", statusFilter);
    if (categoryFilter !== "all") params.set("category", categoryFilter);
    if (debouncedSearch) params.set("search", debouncedSearch);
    window.open(`/api/admin/leads/export?${params}`, "_blank");
  }

  const rawFolderItems = currentFolder ? (currentFolder.children || []) : folders;
  const rawFileItems = rootFiles;

  const folderItems = useMemo(() => {
    if (!debouncedSearch || expandedFile) return rawFolderItems;
    const q = debouncedSearch.toLowerCase();
    return rawFolderItems.filter((f) => f.name.toLowerCase().includes(q));
  }, [rawFolderItems, debouncedSearch, expandedFile]);

  const fileItems = useMemo(() => {
    if (!debouncedSearch || expandedFile) return rawFileItems;
    const q = debouncedSearch.toLowerCase();
    return rawFileItems.filter(
      (f) =>
        f.name.toLowerCase().includes(q) ||
        (f.description && f.description.toLowerCase().includes(q))
    );
  }, [rawFileItems, debouncedSearch, expandedFile]);

  return {
    folders, rootFiles, currentFolder, folderPath, expandedFile, columns, selectedTab,
    leads: sortedLeads, rawLeads: leads, categories, loading, initialLoading, search, debouncedSearch,
    statusFilter, categoryFilter, columnFilters, refreshKey, toast,
    sortField, sortOrder, syncStatus, googleSheetUrl, canWrite, userRole,
    showCreateFolder, showCreateFile, showCreateTab, showCreateColumn,
    editingFolder, editingFile, editingTab, editingLead, selectedLead,
    showImportModal, deleting,
    folderItems, fileItems, confirmDialog,
    setFolders, setRootFiles, setCurrentFolder, setFolderPath, setExpandedFile,
    setColumns, setSelectedTab, setLeads, setCategories, setLoading,
    setSearch, setStatusFilter, setCategoryFilter, setColumnFilters, handleColumnFilterChange, setRefreshKey, setToast,
    setShowCreateFolder, setShowCreateFile, setShowCreateTab, setShowCreateColumn,
    setEditingFolder, setEditingFile, setEditingTab, setEditingLead, setSelectedLead,
    setShowImportModal, setDeleting, requestConfirm, closeConfirm,
    loadTree, refreshFile, navigateToFolder, navigateToRoot, expandFile, openFileById, collapseFile, selectTab,
    handleDeleteFolder, handleDeleteFile, handleDeleteTab, handleDeleteLead,
    promptDeleteFolder, promptDeleteFile, promptDeleteTab,
    saveCellEdit, handleSaveLead, handleExport, handleRenameColumn, handleDeleteColumn, handleAddLead,
    handleDuplicateLead, handleDuplicateTab, handleMergeColumns,
    handleSort,
  };
}

