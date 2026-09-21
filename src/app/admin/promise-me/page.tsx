"use client";

import { useState, useEffect, useRef, useMemo, useCallback } from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import { hasWritePermission } from "@/lib/permissions";
import DropdownSelect from "@/components/DropdownSelect";

interface SchemaField {
  key: string;
  label: string;
  type: string;
  required: boolean;
}

interface FormBridgeProject {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  useDefaultSchema: boolean;
  isActive: boolean;
  schema: { fields: SchemaField[] } | null;
  _count: { submissions: number };
}

interface FormBridgeSubmission {
  id: string;
  projectId: string;
  data: Record<string, any>;
  ipAddress: string | null;
  userAgent: string | null;
  emailVerified: boolean | null;
  emailMx: string | null;
  createdAt: string;
}

const DEFAULT_FIELDS: SchemaField[] = [
  { key: "name", label: "Full Name", type: "text", required: true },
  { key: "email", label: "Email", type: "email", required: true },
  { key: "phone", label: "Phone", type: "tel", required: false },
  { key: "message", label: "Message", type: "textarea", required: true },
  { key: "subject", label: "Subject", type: "text", required: false },
];

interface ContactEnquiry {
  id: string;
  name: string;
  email: string;
  message: string;
  platform: string;
  phone?: string | null;
  subject?: string | null;
  seen: boolean;
  seenAt?: string | null;
  emailVerified?: boolean | null;
  emailMx?: string | null;
  createdAt: string;
  updatedAt: string;
}

interface Pagination {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

interface DnsVerificationResult {
  valid: boolean;
  domain: string;
  primaryMx?: string;
  mxRecords?: { exchange: string; priority: number }[];
  reason?: string;
  isDisposable?: boolean;
  status: string;
}

function getPageNumbers(current: number, total: number): (number | "...")[] {
  if (total <= 7) {
    return Array.from({ length: total }, (_, i) => i + 1);
  }
  if (current <= 3) {
    return [1, 2, 3, 4, "...", total];
  }
  if (current >= total - 2) {
    return [1, "...", total - 3, total - 2, total - 1, total];
  }
  return [1, "...", current - 1, current, current + 1, "...", total];
}

export default function FormSubmissionsPage() {
  const [mounted, setMounted] = useState(false);
  const [enquiries, setEnquiries] = useState<ContactEnquiry[]>([]);
  const [platforms, setPlatforms] = useState<string[]>([]);
  const [selectedPlatform, setSelectedPlatform] = useState<string>("all");
  const [domainStatusFilter, setDomainStatusFilter] = useState<"all" | "valid" | "invalid">("all");
  const [stats, setStats] = useState<{ total: number; validCount: number; invalidCount: number }>({
    total: 0,
    validCount: 0,
    invalidCount: 0,
  });

  // Multi-select state
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [bulkDeleting, setBulkDeleting] = useState(false);
  const [bulkDeleteConfirm, setBulkDeleteConfirm] = useState<{
    isOpen: boolean;
    type: "selected" | "all_invalid";
    count: number;
    ids?: string[];
  } | null>(null);

  // Column search filters
  const [senderFilter, setSenderFilter] = useState("");
  const [emailFilter, setEmailFilter] = useState("");
  const [debouncedSenderFilter, setDebouncedSenderFilter] = useState("");
  const [debouncedEmailFilter, setDebouncedEmailFilter] = useState("");
  const [showColumnFilters, setShowColumnFilters] = useState(false);

  // Sorting
  const [sortField, setSortField] = useState<string>("createdAt");
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("desc");

  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState<number>(10);
  const [pagination, setPagination] = useState<Pagination>({ page: 1, limit: 10, total: 0, totalPages: 0 });
  const [selectedEnquiry, setSelectedEnquiry] = useState<ContactEnquiry | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<ContactEnquiry | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [toast, setToast] = useState<{ type: "success" | "error"; message: string } | null>(null);
  const [canWrite, setCanWrite] = useState(true);
  const [verifyingEmail, setVerifyingEmail] = useState(false);
  const [verificationResult, setVerificationResult] = useState<DnsVerificationResult | null>(null);

  // FormBridge Mode State
  const [activeSource, setActiveSource] = useState<"enquiries" | "formbridge">("enquiries");
  const [fbProjects, setFbProjects] = useState<FormBridgeProject[]>([]);
  const [selectedFbProjectId, setSelectedFbProjectId] = useState<string>("");
  const [fbSubmissions, setFbSubmissions] = useState<FormBridgeSubmission[]>([]);
  const [fbPagination, setFbPagination] = useState<Pagination>({ page: 1, limit: 10, total: 0, totalPages: 0 });
  const [fbLoading, setFbLoading] = useState(false);
  const [selectedFbSubmission, setSelectedFbSubmission] = useState<FormBridgeSubmission | null>(null);
  const [deletingFbId, setDeletingFbId] = useState<string | null>(null);
  const [confirmDeleteFb, setConfirmDeleteFb] = useState<string | null>(null);
  const [fbSearch, setFbSearch] = useState("");
  const [fbDomainFilter, setFbDomainFilter] = useState<"all" | "valid" | "invalid">("all");
  const [fbPage, setFbPage] = useState(1);
  const [fbModalTab, setFbModalTab] = useState<"fields" | "json">("fields");
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  const initialLoadDone = useRef(false);
  const isScrollingRef = useRef(false);
  const scrollTimerRef = useRef<NodeJS.Timeout | null>(null);
  const lastDataSignatureRef = useRef("");

  const scrollToTop = () => {
    const fn = (window as unknown as { __scrollToTop?: () => void }).__scrollToTop;
    if (fn) {
      fn();
    } else {
      document.querySelector(".admin-scroll")?.scrollTo({ top: 0, behavior: "smooth" });
    }
  };

  // Detect active scrolling on admin-scroll container to suppress background poll re-renders
  useEffect(() => {
    const scrollEl = document.querySelector(".admin-scroll");
    if (!scrollEl) return;
    const handleScroll = () => {
      isScrollingRef.current = true;
      if (scrollTimerRef.current) clearTimeout(scrollTimerRef.current);
      scrollTimerRef.current = setTimeout(() => {
        isScrollingRef.current = false;
      }, 350);
    };
    scrollEl.addEventListener("scroll", handleScroll, { passive: true });
    return () => scrollEl.removeEventListener("scroll", handleScroll);
  }, []);

  const runEmailVerification = (targetEmail: string) => {
    setVerifyingEmail(true);
    fetch(`/api/admin/verify-email?email=${encodeURIComponent(targetEmail)}`)
      .then((r) => r.json())
      .then((data) => {
        if (data && typeof data.valid === "boolean") {
          setVerificationResult(data);
        }
      })
      .catch(() => {
        setVerificationResult({
          valid: false,
          domain: targetEmail.split("@")[1] || "",
          status: "unreachable",
          reason: "DNS verification request failed",
        });
      })
      .finally(() => setVerifyingEmail(false));
  };

  useEffect(() => {
    if (!selectedEnquiry) {
      setVerificationResult(null);
      setVerifyingEmail(false);
      return;
    }
    runEmailVerification(selectedEnquiry.email);
  }, [selectedEnquiry]);

  useEffect(() => {
    setMounted(true);
  }, []);

  // Lock background scrolling when any modal is open
  useEffect(() => {
    if (selectedEnquiry || deleteTarget || bulkDeleteConfirm || selectedFbSubmission) {
      const mainEl = document.querySelector(".admin-scroll") as HTMLElement | null;
      const prevMain = mainEl ? mainEl.style.overflow : "";
      const prevBody = document.body.style.overflow;
      if (mainEl) mainEl.style.overflow = "hidden";
      document.body.style.overflow = "hidden";
      return () => {
        if (mainEl) mainEl.style.overflow = prevMain;
        document.body.style.overflow = prevBody;
      };
    }
  }, [selectedEnquiry, deleteTarget, bulkDeleteConfirm, selectedFbSubmission]);

  // Close modals on Escape key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        if (bulkDeleteConfirm) setBulkDeleteConfirm(null);
        else if (deleteTarget) setDeleteTarget(null);
        else if (selectedEnquiry) setSelectedEnquiry(null);
        else if (selectedFbSubmission) setSelectedFbSubmission(null);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [selectedEnquiry, deleteTarget, bulkDeleteConfirm, selectedFbSubmission]);

  // FormBridge: Detect URL project or source parameter
  useEffect(() => {
    if (typeof window !== "undefined") {
      const urlParams = new URLSearchParams(window.location.search);
      const projParam = urlParams.get("project");
      const sourceParam = urlParams.get("source");
      if (projParam) {
        setActiveSource("formbridge");
        setSelectedFbProjectId(projParam);
      } else if (sourceParam === "formbridge") {
        setActiveSource("formbridge");
      }
    }
  }, []);

  // FormBridge: Fetch all form projects
  const fetchFbProjects = useCallback(async () => {
    try {
      const res = await fetch("/api/admin/forms/projects");
      if (res.ok) {
        const data = await res.json();
        const projs: FormBridgeProject[] = data.projects || [];
        setFbProjects(projs);
        if (projs.length > 0) {
          setSelectedFbProjectId((prev) => {
            if (prev && projs.some((p) => p.id === prev || p.slug === prev)) {
              const match = projs.find((p) => p.id === prev || p.slug === prev);
              return match ? match.id : prev;
            }
            return projs[0].id;
          });
        }
      }
    } catch (err) {
      console.error("Failed to fetch FormBridge projects:", err);
    }
  }, []);

  // FormBridge: Fetch submissions for active project
  const fetchFbSubmissions = useCallback(
    async (projectId: string, p = 1, l = 10) => {
      if (!projectId) return;
      setFbLoading(true);
      try {
        const res = await fetch(
          `/api/admin/forms/projects/${projectId}/submissions?page=${p}&limit=${l}`
        );
        if (res.ok) {
          const data = await res.json();
          setFbSubmissions(data.submissions || []);
          if (data.pagination) {
            setFbPagination(data.pagination);
          }
        }
      } catch (err) {
        console.error("Failed to fetch FormBridge submissions:", err);
      } finally {
        setFbLoading(false);
      }
    },
    []
  );

  useEffect(() => {
    fetchFbProjects();
  }, [fetchFbProjects, refreshKey]);

  useEffect(() => {
    if (activeSource === "formbridge" && selectedFbProjectId) {
      fetchFbSubmissions(selectedFbProjectId, fbPage, 10);
    }
  }, [activeSource, selectedFbProjectId, fbPage, refreshKey, fetchFbSubmissions]);

  // FormBridge: Computed active project, fields, and filtered submissions
  const selectedFbProject = useMemo(() => {
    return fbProjects.find((p) => p.id === selectedFbProjectId || p.slug === selectedFbProjectId);
  }, [fbProjects, selectedFbProjectId]);

  const totalFbSubmissions = useMemo(() => {
    return fbProjects.reduce((acc, p) => acc + (p._count?.submissions || 0), 0);
  }, [fbProjects]);

  const effectiveFbFields = useMemo(() => {
    if (!selectedFbProject) return [];
    if (selectedFbProject.useDefaultSchema) return DEFAULT_FIELDS;
    if (selectedFbProject.schema?.fields && selectedFbProject.schema.fields.length > 0) {
      return selectedFbProject.schema.fields;
    }
    const allKeys = Array.from(new Set(fbSubmissions.flatMap((s) => Object.keys(s.data || {}))));
    return allKeys.map((k) => ({
      key: k,
      label: k.charAt(0).toUpperCase() + k.slice(1),
      type: "text",
      required: false,
    }));
  }, [selectedFbProject, fbSubmissions]);

  const extraFbKeys = useMemo(() => {
    const declared = new Set(effectiveFbFields.map((f) => f.key));
    const allKeys = Array.from(new Set(fbSubmissions.flatMap((s) => Object.keys(s.data || {}))));
    return allKeys.filter((k) => !declared.has(k));
  }, [effectiveFbFields, fbSubmissions]);

  const allDisplayColumns = useMemo(() => {
    return [
      ...effectiveFbFields,
      ...extraFbKeys.map((k) => ({
        key: k,
        label: k.charAt(0).toUpperCase() + k.slice(1),
        type: "text",
        required: false,
      })),
    ];
  }, [effectiveFbFields, extraFbKeys]);

  const filteredFbSubmissions = useMemo(() => {
    return fbSubmissions.filter((sub) => {
      if (fbDomainFilter === "valid" && sub.emailVerified !== true) return false;
      if (fbDomainFilter === "invalid" && sub.emailVerified === true) return false;

      if (fbSearch.trim()) {
        const query = fbSearch.toLowerCase();
        const matchesData = Object.values(sub.data || {}).some((v) =>
          String(v).toLowerCase().includes(query)
        );
        const matchesMeta =
          (sub.ipAddress || "").toLowerCase().includes(query) ||
          (sub.userAgent || "").toLowerCase().includes(query);
        if (!matchesData && !matchesMeta) return false;
      }
      return true;
    });
  }, [fbSubmissions, fbDomainFilter, fbSearch]);

  const handleDeleteFbSubmission = async (submissionId: string) => {
    setConfirmDeleteFb(submissionId);
  };

  const confirmDeleteFbAction = async () => {
    if (!confirmDeleteFb) return;
    const submissionId = confirmDeleteFb;
    setConfirmDeleteFb(null);
    setDeletingFbId(submissionId);
    try {
      const res = await fetch(
        `/api/admin/forms/projects/${selectedFbProjectId}/submissions?submissionId=${submissionId}`,
        { method: "DELETE" }
      );
      if (res.ok) {
        setToast({ type: "success", message: "Submission deleted successfully" });
        if (selectedFbSubmission?.id === submissionId) {
          setSelectedFbSubmission(null);
        }
        fetchFbSubmissions(selectedFbProjectId, fbPage, 10);
        fetchFbProjects();
      } else {
        setToast({ type: "error", message: "Failed to delete submission" });
      }
    } catch {
      setToast({ type: "error", message: "Error deleting submission" });
    } finally {
      setDeletingFbId(null);
    }
  };

  useEffect(() => {
    const fetchUser = () => {
      fetch("/api/admin/auth/me")
        .then((r) => r.json())
        .then((data) => {
          if (data.user) {
            if (data.user.role === "admin") {
              setCanWrite(true);
            } else {
              setCanWrite(hasWritePermission(data.user.permissions, "forms"));
            }
          }
        })
        .catch(() => {});
    };

    fetchUser();
  }, []);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 4000);
    return () => clearTimeout(t);
  }, [toast]);

  useEffect(() => {
    const t = setTimeout(() => { setDebouncedSearch(search); setPage(1); }, 300);
    return () => clearTimeout(t);
  }, [search]);

  useEffect(() => {
    const t = setTimeout(() => { setDebouncedSenderFilter(senderFilter); setPage(1); }, 300);
    return () => clearTimeout(t);
  }, [senderFilter]);

  useEffect(() => {
    const t = setTimeout(() => { setDebouncedEmailFilter(emailFilter); setPage(1); }, 300);
    return () => clearTimeout(t);
  }, [emailFilter]);

  useEffect(() => {
    let cancelled = false;

    const loadData = (isBackground = false) => {
      // If user is actively scrolling, skip background poll to maintain 144Hz butter smoothness
      if (isBackground && isScrollingRef.current) return;

      if (!isBackground && initialLoadDone.current) setLoading(true);
      const params = new URLSearchParams();
      if (debouncedSearch) params.set("search", debouncedSearch);
      if (selectedPlatform && selectedPlatform !== "all") params.set("platform", selectedPlatform);
      if (domainStatusFilter && domainStatusFilter !== "all") params.set("domainStatus", domainStatusFilter);
      if (debouncedSenderFilter) params.set("senderSearch", debouncedSenderFilter);
      if (debouncedEmailFilter) params.set("emailSearch", debouncedEmailFilter);
      params.set("sortField", sortField);
      params.set("sortOrder", sortOrder);
      params.set("page", String(page));
      params.set("limit", String(pageSize));

      fetch(`/api/admin/promise-me?${params}`)
        .then((r) => (r.ok ? r.json() : null))
        .then((data) => {
          if (!cancelled && data) {
            // Check signature on background poll: if identical, do NOT touch React state (prevents scroll hitching)
            const signature = `${data.pagination?.total}_${(data.enquiries || []).map((e: ContactEnquiry) => `${e.id}_${e.emailVerified}`).join("|")}`;
            if (isBackground && signature === lastDataSignatureRef.current) {
              return;
            }
            lastDataSignatureRef.current = signature;

            setEnquiries(data.enquiries || []);
            if (data.platforms) setPlatforms(data.platforms);
            if (data.pagination) setPagination(data.pagination);
            if (data.stats) setStats(data.stats);
          }
        })
        .catch(() => {
          if (!cancelled && !isBackground) {
            setToast({ type: "error", message: "Failed to load enquiries" });
          }
        })
        .finally(() => {
          if (!cancelled) {
            setLoading(false);
            initialLoadDone.current = true;
          }
        });
    };

    // Initial load
    loadData(false);

    // Polite background sync (20s interval, skipped while scrolling or modals open)
    const interval = setInterval(() => {
      if (document.hidden || selectedEnquiry || deleteTarget || bulkDeleteConfirm) return;
      loadData(true);
    }, 20000);

    const handleFocus = () => loadData(true);
    window.addEventListener("focus", handleFocus);

    return () => {
      cancelled = true;
      clearInterval(interval);
      window.removeEventListener("focus", handleFocus);
    };
  }, [
    debouncedSearch,
    selectedPlatform,
    domainStatusFilter,
    debouncedSenderFilter,
    debouncedEmailFilter,
    sortField,
    sortOrder,
    page,
    pageSize,
    refreshKey,
    selectedEnquiry,
    deleteTarget,
    bulkDeleteConfirm,
  ]);

  const handleSort = (field: string) => {
    if (sortField === field) {
      setSortOrder(sortOrder === "asc" ? "desc" : "asc");
    } else {
      setSortField(field);
      setSortOrder("asc");
    }
    setPage(1);
  };

  const clearAllFilters = () => {
    setSearch("");
    setDebouncedSearch("");
    setSelectedPlatform("all");
    setDomainStatusFilter("all");
    setSenderFilter("");
    setDebouncedSenderFilter("");
    setEmailFilter("");
    setDebouncedEmailFilter("");
    setSortField("createdAt");
    setSortOrder("desc");
    setPage(1);
  };

  const hasActiveFilters =
    search ||
    selectedPlatform !== "all" ||
    domainStatusFilter !== "all" ||
    senderFilter ||
    emailFilter ||
    sortField !== "createdAt" ||
    sortOrder !== "desc";

  // Multi-select helpers
  const visibleIds = useMemo(() => enquiries.map((e) => e.id), [enquiries]);
  const invalidVisibleIds = useMemo(
    () => enquiries.filter((e) => e.emailVerified === false || e.emailVerified == null).map((e) => e.id),
    [enquiries]
  );

  const isAllVisibleSelected = visibleIds.length > 0 && visibleIds.every((id) => selectedIds.includes(id));
  const isSomeVisibleSelected = visibleIds.some((id) => selectedIds.includes(id)) && !isAllVisibleSelected;

  const toggleSelectAllVisible = () => {
    if (isAllVisibleSelected) {
      setSelectedIds((prev) => prev.filter((id) => !visibleIds.includes(id)));
    } else {
      setSelectedIds((prev) => Array.from(new Set([...prev, ...visibleIds])));
    }
  };

  const toggleSelectRow = useCallback((id: string) => {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    );
  }, []);

  // Select ONLY invalid domain submissions (unchecks valid domains)
  const selectInvalidOnly = () => {
    setSelectedIds([...invalidVisibleIds]);
  };

  const selectAllOnPage = () => {
    setSelectedIds([...visibleIds]);
  };

  const deselectAll = () => {
    setSelectedIds([]);
  };

  const selectedInvalidCount = useMemo(() => {
    return enquiries.filter((e) => selectedIds.includes(e.id) && (e.emailVerified === false || e.emailVerified == null)).length;
  }, [enquiries, selectedIds]);

  async function confirmDelete() {
    if (!deleteTarget) return;
    const id = deleteTarget.id;
    setDeleting(id);
    try {
      const res = await fetch(`/api/admin/promise-me?id=${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Failed");
      setToast({ type: "success", message: "Submission deleted successfully" });
      if (selectedEnquiry?.id === id) setSelectedEnquiry(null);
      setDeleteTarget(null);
      setSelectedIds((prev) => prev.filter((i) => i !== id));
      setRefreshKey((k) => k + 1);
    } catch {
      setToast({ type: "error", message: "Failed to delete submission" });
    } finally {
      setDeleting(null);
    }
  }

  async function executeBulkDelete() {
    if (!bulkDeleteConfirm) return;
    setBulkDeleting(true);
    try {
      let res: Response;
      if (bulkDeleteConfirm.type === "all_invalid") {
        const params = new URLSearchParams();
        params.set("target", "invalid_domains");
        if (selectedPlatform && selectedPlatform !== "all") {
          params.set("platform", selectedPlatform);
        }
        res = await fetch(`/api/admin/promise-me?${params}`, { method: "DELETE" });
      } else {
        res = await fetch("/api/admin/promise-me", {
          method: "DELETE",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ ids: bulkDeleteConfirm.ids || selectedIds }),
        });
      }

      if (!res.ok) throw new Error("Delete failed");
      const data = await res.json();
      const count = data.count ?? bulkDeleteConfirm.count;
      setToast({
        type: "success",
        message: `Successfully deleted ${count} submission${count === 1 ? "" : "s"}`,
      });
      setSelectedIds([]);
      setBulkDeleteConfirm(null);
      setRefreshKey((k) => k + 1);
    } catch {
      setToast({ type: "error", message: "Failed to bulk delete submissions" });
    } finally {
      setBulkDeleting(false);
    }
  }

  return (
    <div className="w-full p-4 sm:p-6 lg:p-8 space-y-6">
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

      {/* Confirm Delete FB Submission Modal */}
      {confirmDeleteFb && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-[#111114] border border-zinc-200 dark:border-zinc-800 rounded-2xl p-6 max-w-sm w-full shadow-2xl">
            <div className="w-12 h-12 rounded-2xl bg-red-500/10 border border-red-500/20 text-red-500 flex items-center justify-center mx-auto mb-4">
              <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
              </svg>
            </div>
            <h2 className="text-lg font-bold text-zinc-900 dark:text-white text-center mb-2">Delete Submission?</h2>
            <p className="text-sm text-zinc-500 text-center mb-6">Are you sure you want to delete this submission? This action cannot be undone.</p>
            <div className="flex gap-3">
              <button onClick={() => setConfirmDeleteFb(null)} className="flex-1 px-4 py-2.5 rounded-xl text-sm font-semibold bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 hover:bg-zinc-200 dark:hover:bg-zinc-700 transition cursor-pointer">Cancel</button>
              <button onClick={confirmDeleteFbAction} className="flex-1 px-4 py-2.5 rounded-xl text-sm font-semibold bg-red-600 text-white hover:bg-red-700 transition cursor-pointer">Delete</button>
            </div>
          </div>
        </div>
      )}

      {/* 1. Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-zinc-900 dark:text-white flex items-center gap-2.5">
            <span className="p-2 rounded-xl bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/20">
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
              </svg>
            </span>
            Form Submissions
          </h1>
          <p className="text-sm text-zinc-500 dark:text-zinc-400 mt-1">
            Review, verify, and filter contact enquiries and form submissions across all connected platforms.
          </p>
        </div>

        <div className="flex items-center gap-2.5 shrink-0">
          <button
            onClick={() => setRefreshKey((k) => k + 1)}
            className="flex items-center gap-2 px-3.5 py-2 text-xs font-semibold text-zinc-700 dark:text-zinc-200 bg-white dark:bg-[#111114] hover:bg-zinc-100 dark:hover:bg-zinc-800 border border-zinc-200 dark:border-zinc-800 hover:border-zinc-300 dark:hover:border-zinc-700 rounded-xl transition-all duration-150 cursor-pointer shadow-xs active:scale-97"
            title="Refresh Enquiries"
          >
            <svg className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0l3.181 3.183a8.25 8.25 0 0013.803-3.7M4.031 9.865a8.25 8.25 0 0113.803-3.7l3.181 3.182" />
            </svg>
            <span>Refresh</span>
          </button>
        </div>
      </div>

      {/* 2. Source Selector Tabs: General Enquiries vs FormBridge Forms */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-2 bg-slate-100 dark:bg-[#111114] border border-zinc-200 dark:border-zinc-800 rounded-2xl shadow-xs">
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => setActiveSource("enquiries")}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
              activeSource === "enquiries"
                ? "bg-white dark:bg-zinc-800 text-blue-600 dark:text-blue-400 shadow-sm border border-zinc-200/80 dark:border-zinc-700/60"
                : "text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-200 hover:bg-zinc-200/60 dark:hover:bg-zinc-800/40"
            }`}
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M21.75 6.75v10.5a2.25 2.25 0 01-2.25 2.25h-15a2.25 2.25 0 01-2.25-2.25V6.75m19.5 0A2.25 2.25 0 0019.5 4.5h-15a2.25 2.25 0 00-2.25 2.25m19.5 0v.243a2.25 2.25 0 01-1.07 1.916l-7.5 4.615a2.25 2.25 0 01-2.36 0L3.32 8.91a2.25 2.25 0 01-1.07-1.916V6.75" />
            </svg>
            <span>General Contact Enquiries</span>
            <span className="px-2 py-0.5 rounded-full text-[10px] bg-blue-500/10 text-blue-600 dark:text-blue-400 font-bold border border-blue-500/20">
              {stats.total}
            </span>
          </button>

          <button
            type="button"
            onClick={() => {
              setActiveSource("formbridge");
              if (!selectedFbProjectId && fbProjects.length > 0) {
                setSelectedFbProjectId(fbProjects[0].id);
              }
            }}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
              activeSource === "formbridge"
                ? "bg-white dark:bg-zinc-800 text-purple-600 dark:text-purple-400 shadow-sm border border-zinc-200/80 dark:border-zinc-700/60"
                : "text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-200 hover:bg-zinc-200/60 dark:hover:bg-zinc-800/40"
            }`}
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
            </svg>
            <span>FormBridge Custom Forms</span>
            <span className="px-2 py-0.5 rounded-full text-[10px] bg-purple-500/10 text-purple-600 dark:text-purple-400 font-bold border border-purple-500/20">
              {totalFbSubmissions}
            </span>
          </button>
        </div>

        {activeSource === "formbridge" && (
          <Link
            href="/admin/forms"
            className="flex items-center gap-1.5 text-xs font-semibold text-blue-600 dark:text-blue-400 hover:underline px-3 py-1.5"
          >
            <span>Manage FormBridge Projects</span>
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5L21 12m0 0l-7.5 7.5M21 12H3" />
            </svg>
          </Link>
        )}
      </div>

      {/* 3. Summary KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {activeSource === "enquiries" ? (
          <>
            {/* Total Submissions */}
            <div className="bg-white dark:bg-[#111114] border border-zinc-200 dark:border-zinc-800 rounded-2xl p-5 shadow-xs hover:border-zinc-300 dark:hover:border-zinc-700 transition-all">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider">Total Enquiries</span>
                <span className="w-8 h-8 rounded-lg bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/20 flex items-center justify-center">
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M21.75 6.75v10.5a2.25 2.25 0 01-2.25 2.25h-15a2.25 2.25 0 01-2.25-2.25V6.75m19.5 0A2.25 2.25 0 0019.5 4.5h-15a2.25 2.25 0 00-2.25 2.25m19.5 0v.243a2.25 2.25 0 01-1.07 1.916l-7.5 4.615a2.25 2.25 0 01-2.36 0L3.32 8.91a2.25 2.25 0 01-1.07-1.916V6.75" />
                  </svg>
                </span>
              </div>
              <div className="mt-3 flex items-baseline gap-2">
                <span className="text-2xl font-bold tracking-tight text-zinc-900 dark:text-white">{stats.total}</span>
                <span className="text-xs text-zinc-400 font-medium">submissions</span>
              </div>
            </div>

            {/* Verified Domains */}
            <div className="bg-white dark:bg-[#111114] border border-zinc-200 dark:border-zinc-800 rounded-2xl p-5 shadow-xs hover:border-zinc-300 dark:hover:border-zinc-700 transition-all">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider">Verified Domains</span>
                <span className="w-8 h-8 rounded-lg bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 flex items-center justify-center">
                  <div className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse" />
                </span>
              </div>
              <div className="mt-3 flex items-baseline gap-2">
                <span className="text-2xl font-bold tracking-tight text-zinc-900 dark:text-white">{stats.validCount}</span>
                <span className="text-xs text-emerald-600 dark:text-emerald-400 font-medium">legitimate</span>
              </div>
            </div>

            {/* Invalid Domains */}
            <div className="bg-white dark:bg-[#111114] border border-zinc-200 dark:border-zinc-800 rounded-2xl p-5 shadow-xs hover:border-zinc-300 dark:hover:border-zinc-700 transition-all">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider">Invalid Domains</span>
                <span className="w-8 h-8 rounded-lg bg-red-500/10 text-red-600 dark:text-red-400 border border-red-500/20 flex items-center justify-center">
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z" />
                  </svg>
                </span>
              </div>
              <div className="mt-3 flex items-baseline gap-2">
                <span className="text-2xl font-bold tracking-tight text-zinc-900 dark:text-white">{stats.invalidCount}</span>
                <span className="text-xs text-red-600 dark:text-red-400 font-medium">bounced / disposable</span>
              </div>
            </div>

            {/* Connected Platforms */}
            <div className="bg-white dark:bg-[#111114] border border-zinc-200 dark:border-zinc-800 rounded-2xl p-5 shadow-xs hover:border-zinc-300 dark:hover:border-zinc-700 transition-all">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider">Active Platforms</span>
                <span className="w-8 h-8 rounded-lg bg-purple-500/10 text-purple-600 dark:text-purple-400 border border-purple-500/20 flex items-center justify-center">
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M13.19 8.688a4.5 4.5 0 011.242 7.244l-4.5 4.5a4.5 4.5 0 01-6.364-6.364l1.757-1.757m13.35-.622l1.757-1.757a4.5 4.5 0 00-6.364-6.364l-4.5 4.5a4.5 4.5 0 001.242 7.244" />
                  </svg>
                </span>
              </div>
              <div className="mt-3 flex items-baseline gap-2">
                <span className="text-2xl font-bold tracking-tight text-zinc-900 dark:text-white">{platforms.length || 1}</span>
                <span className="text-xs text-purple-600 dark:text-purple-400 font-medium">sources</span>
              </div>
            </div>
          </>
        ) : (
          <>
            {/* FormBridge Projects Count */}
            <div className="bg-white dark:bg-[#111114] border border-zinc-200 dark:border-zinc-800 rounded-2xl p-5 shadow-xs hover:border-zinc-300 dark:hover:border-zinc-700 transition-all">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider">FormBridge Projects</span>
                <span className="w-8 h-8 rounded-lg bg-purple-500/10 text-purple-600 dark:text-purple-400 border border-purple-500/20 flex items-center justify-center">
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 12.75V12A2.25 2.25 0 014.5 9.75h15A2.25 2.25 0 0121.75 12v.75m-8.69-6.44l-2.12-2.12a1.5 1.5 0 00-1.061-.44H4.5A2.25 2.25 0 002.25 6v12a2.25 2.25 0 002.25 2.25h15A2.25 2.25 0 0021.75 18V9a2.25 2.25 0 00-2.25-2.25h-5.379a1.5 1.5 0 01-1.06-.44z" />
                  </svg>
                </span>
              </div>
              <div className="mt-3 flex items-baseline gap-2">
                <span className="text-2xl font-bold tracking-tight text-zinc-900 dark:text-white">{fbProjects.length}</span>
                <span className="text-xs text-zinc-400 font-medium">forms active</span>
              </div>
            </div>

            {/* Total FormBridge Submissions */}
            <div className="bg-white dark:bg-[#111114] border border-zinc-200 dark:border-zinc-800 rounded-2xl p-5 shadow-xs hover:border-zinc-300 dark:hover:border-zinc-700 transition-all">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider">Total Submissions</span>
                <span className="w-8 h-8 rounded-lg bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/20 flex items-center justify-center">
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
                  </svg>
                </span>
              </div>
              <div className="mt-3 flex items-baseline gap-2">
                <span className="text-2xl font-bold tracking-tight text-zinc-900 dark:text-white">{totalFbSubmissions}</span>
                <span className="text-xs text-blue-600 dark:text-blue-400 font-medium">all forms</span>
              </div>
            </div>

            {/* Selected Form Submissions */}
            <div className="bg-white dark:bg-[#111114] border border-zinc-200 dark:border-zinc-800 rounded-2xl p-5 shadow-xs hover:border-zinc-300 dark:hover:border-zinc-700 transition-all">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider truncate">
                  {selectedFbProject?.name || "Selected Form"}
                </span>
                <span className="w-8 h-8 rounded-lg bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 flex items-center justify-center">
                  <div className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse" />
                </span>
              </div>
              <div className="mt-3 flex items-baseline gap-2">
                <span className="text-2xl font-bold tracking-tight text-zinc-900 dark:text-white">
                  {selectedFbProject?._count?.submissions || 0}
                </span>
                <span className="text-xs text-emerald-600 dark:text-emerald-400 font-medium">records</span>
              </div>
            </div>

            {/* Schema Fields Defined */}
            <div className="bg-white dark:bg-[#111114] border border-zinc-200 dark:border-zinc-800 rounded-2xl p-5 shadow-xs hover:border-zinc-300 dark:hover:border-zinc-700 transition-all">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider">Schema Columns</span>
                <span className="w-8 h-8 rounded-lg bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20 flex items-center justify-center">
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6A2.25 2.25 0 016 3.75h2.25A2.25 2.25 0 0110.5 6v2.25a2.25 2.25 0 01-2.25 2.25H6a2.25 2.25 0 01-2.25-2.25V6z" />
                  </svg>
                </span>
              </div>
              <div className="mt-3 flex items-baseline gap-2">
                <span className="text-2xl font-bold tracking-tight text-zinc-900 dark:text-white">
                  {allDisplayColumns.length}
                </span>
                <span className="text-xs text-amber-600 dark:text-amber-400 font-medium">dynamic fields</span>
              </div>
            </div>
          </>
        )}
      </div>

      {activeSource === "enquiries" ? (
        <>
          {/* Quick Filter Tabs for Domain Status */}
          <div className="flex flex-wrap items-center justify-between gap-3 p-1.5 bg-slate-100 dark:bg-[#111114] rounded-2xl border border-zinc-200 dark:border-zinc-800 shadow-xs">
        <div className="flex flex-wrap items-center gap-1.5">
          <button
            onClick={() => { setDomainStatusFilter("all"); setPage(1); }}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium cursor-pointer transition ${
              domainStatusFilter === "all"
                ? "bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 font-semibold shadow-xs border border-zinc-200/80 dark:border-zinc-700/50"
                : "text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-200 hover:bg-zinc-200/60 dark:hover:bg-zinc-800/40"
            }`}
          >
            All Submissions ({stats.total})
          </button>
          <button
            onClick={() => { setDomainStatusFilter("valid"); setPage(1); }}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium cursor-pointer transition ${
              domainStatusFilter === "valid"
                ? "bg-emerald-100 text-emerald-800 border border-emerald-300 dark:bg-emerald-500/15 dark:text-emerald-400 dark:border-emerald-500/30 font-semibold shadow-xs"
                : "text-emerald-700 hover:bg-emerald-50 hover:text-emerald-900 dark:text-emerald-400/80 dark:hover:bg-emerald-950/40 dark:hover:text-emerald-300"
            }`}
          >
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
            Verified ({stats.validCount})
          </button>
          <button
            onClick={() => { setDomainStatusFilter("invalid"); setPage(1); }}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium cursor-pointer transition ${
              domainStatusFilter === "invalid"
                ? "bg-red-100 text-red-800 border border-red-300 dark:bg-red-500/15 dark:text-red-400 dark:border-red-500/30 font-semibold shadow-xs"
                : "text-red-700 hover:bg-red-50 hover:text-red-900 dark:text-red-400/80 dark:hover:bg-red-950/40 dark:hover:text-red-300"
            }`}
          >
            <span className="w-1.5 h-1.5 rounded-full bg-red-500" />
            Invalid ({stats.invalidCount})
          </button>
        </div>

        {/* Dedicated Quick Actions for Invalid Domains */}
        {canWrite && stats.invalidCount > 0 && (
          <div className="flex items-center gap-1.5">
            <button
              onClick={selectInvalidOnly}
              className="flex items-center gap-1.5 h-8 px-3 rounded-lg text-xs font-medium text-zinc-700 dark:text-zinc-300 bg-white dark:bg-zinc-900 hover:bg-zinc-100 dark:hover:bg-zinc-800 border border-zinc-200 dark:border-zinc-800 transition-colors cursor-pointer shadow-xs"
              title="Select only the invalid domain submissions"
            >
              <svg className="w-3.5 h-3.5 text-zinc-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              Select Invalid ({stats.invalidCount})
            </button>

            <button
              onClick={() =>
                setBulkDeleteConfirm({
                  isOpen: true,
                  type: "all_invalid",
                  count: stats.invalidCount,
                })
              }
              className="flex items-center gap-1.5 h-8 px-3 rounded-lg text-xs font-medium text-red-700 dark:text-red-400 bg-red-50 dark:bg-red-500/10 hover:bg-red-100 dark:hover:bg-red-500/20 border border-red-200 dark:border-red-500/20 transition-colors cursor-pointer shadow-xs"
              title="Delete all invalid domain submissions from the database"
            >
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0" />
              </svg>
              Delete All Invalid ({stats.invalidCount})
            </button>
          </div>
        )}
      </div>

      {/* Filter and Search Toolbar */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <svg className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-400 dark:text-zinc-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z" />
          </svg>
          <input
            type="text"
            placeholder="Search across all fields..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full bg-white dark:bg-[#111114] border border-zinc-200 dark:border-zinc-800 rounded-xl pl-10 pr-4 py-2.5 text-xs text-zinc-900 dark:text-zinc-200 placeholder:text-zinc-400 dark:placeholder:text-zinc-500 focus:outline-none focus:border-zinc-400 dark:focus:border-zinc-600 transition shadow-xs"
          />
        </div>

        {(platforms.length > 0 || fbProjects.length > 0) && (
          <DropdownSelect
            value={selectedPlatform}
            onChange={(val) => {
              if (val.startsWith("fb:")) {
                const projId = val.replace("fb:", "");
                setActiveSource("formbridge");
                setSelectedFbProjectId(projId);
                return;
              }
              setSelectedPlatform(val);
              setPage(1);
            }}
            options={[
              { label: `All Platforms (${stats.total})`, value: "all" },
              ...platforms.map((p) => ({ label: p, value: p })),
              ...(fbProjects.length > 0
                ? [
                    ...fbProjects.map((fp) => ({
                      label: `⚡ Form: ${fp.name} (${fp._count?.submissions || 0})`,
                      value: `fb:${fp.id}`,
                    })),
                  ]
                : []),
            ]}
            className="w-full sm:w-56 shrink-0"
            align="right"
            minWidth="200px"
          />
        )}

        <DropdownSelect
          value={domainStatusFilter}
          onChange={(val) => {
            setDomainStatusFilter(val as "all" | "valid" | "invalid");
            setPage(1);
          }}
          options={[
            { label: `All Domains (${stats.total})`, value: "all" },
            { label: `✓ Valid Domains (${stats.validCount})`, value: "valid" },
            { label: `✕ Invalid Domains (${stats.invalidCount})`, value: "invalid" },
          ]}
          className="w-full sm:w-56 shrink-0"
          align="right"
          minWidth="220px"
        />

        <button
          onClick={() => setShowColumnFilters((prev) => !prev)}
          className={`flex items-center gap-2 px-3.5 py-2 text-xs font-semibold rounded-xl border transition-all duration-150 cursor-pointer shadow-xs shrink-0 active:scale-97 ${
            showColumnFilters || senderFilter || emailFilter
              ? "bg-blue-50 dark:bg-blue-950/50 text-blue-700 dark:text-blue-400 border-blue-200 dark:border-blue-900/60 shadow-xs font-bold"
              : "bg-white dark:bg-[#111114] text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800 border-zinc-200 dark:border-zinc-800 hover:border-zinc-300 dark:hover:border-zinc-700"
          }`}
          title="Toggle column-based search and filter inputs"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 3c2.755 0 5.455.232 8.083.678.533.09.917.556.917 1.096v1.044a2.25 2.25 0 01-.659 1.591l-5.432 5.432a2.25 2.25 0 00-.659 1.591v2.927a2.25 2.25 0 01-1.244 2.013L9.75 21v-6.568a2.25 2.25 0 00-.659-1.591L3.659 7.409A2.25 2.25 0 013 5.818V4.774c0-.54.384-1.006.917-1.096A48.32 48.32 0 0112 3z" />
          </svg>
          Column Filters
          {(senderFilter || emailFilter) && (
            <span className="w-2 h-2 rounded-full bg-emerald-500" />
          )}
        </button>

        {hasActiveFilters && (
          <button
            onClick={clearAllFilters}
            className="flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-zinc-700 dark:text-zinc-300 hover:text-red-600 dark:hover:text-red-400 bg-white dark:bg-[#111114] hover:bg-zinc-100 dark:hover:bg-zinc-800 border border-zinc-200 dark:border-zinc-800 hover:border-zinc-300 dark:hover:border-zinc-700 rounded-xl transition-all duration-150 cursor-pointer shadow-xs active:scale-97 shrink-0"
            title="Clear all filters"
          >
            Reset
          </button>
        )}
      </div>

      {/* Multi-Select Action Banner (appears when rows are selected) */}
      {selectedIds.length > 0 && (
        <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-3 bg-blue-500/10 border border-blue-500/20 rounded-2xl animate-in slide-in-from-top-2 duration-150">
          <div className="flex items-center gap-3">
            <div className="w-7 h-7 rounded-xl bg-blue-600 flex items-center justify-center text-xs font-bold text-white shadow-xs">
              {selectedIds.length}
            </div>
            <div>
              <p className="text-xs font-semibold text-zinc-900 dark:text-white">
                {selectedIds.length} {selectedIds.length === 1 ? "submission" : "submissions"} selected
              </p>
              <p className="text-[11px] text-zinc-500 dark:text-zinc-400">
                Bulk action controls for selected entries
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {canWrite && invalidVisibleIds.length > 0 && (
              <button
                onClick={selectInvalidOnly}
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-500/20 cursor-pointer transition-colors"
                title="Select ONLY the invalid domain submissions and uncheck valid ones"
              >
                <span className="w-1.5 h-1.5 rounded-full bg-red-400" />
                Select Only Invalid ({invalidVisibleIds.length})
              </button>
            )}

            <button
              onClick={selectAllOnPage}
              className="px-3 py-1.5 text-xs font-medium rounded-lg bg-white dark:bg-zinc-800 hover:bg-zinc-100 dark:hover:bg-zinc-700 text-zinc-800 dark:text-zinc-200 border border-zinc-200 dark:border-zinc-700 cursor-pointer shadow-xs"
            >
              Select All ({visibleIds.length})
            </button>

            <button
              onClick={deselectAll}
              className="px-3 py-1.5 text-xs font-medium rounded-lg text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white cursor-pointer"
            >
              Clear
            </button>

            <button
              onClick={() =>
                setBulkDeleteConfirm({
                  isOpen: true,
                  type: "selected",
                  count: selectedIds.length,
                  ids: selectedIds,
                })
              }
              className="px-3.5 py-1.5 text-xs font-bold rounded-lg bg-red-600 hover:bg-red-700 text-white shadow-xs cursor-pointer flex items-center gap-1.5"
            >
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0" />
              </svg>
              Delete Selected ({selectedIds.length})
            </button>
          </div>
        </div>
      )}

      {/* Submissions Table with 144Hz Smooth Scrolling Optimization */}
      <div className="bg-white dark:bg-[#111114] border border-zinc-200 dark:border-zinc-800 rounded-2xl overflow-hidden shadow-xs">
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <div className="w-6 h-6 border-2 border-zinc-400 dark:border-zinc-600 border-t-zinc-900 dark:border-t-zinc-300 rounded-full animate-spin" />
          </div>
        ) : enquiries.length === 0 ? (
          <div className="text-center py-20">
            <svg className="w-12 h-12 mx-auto text-zinc-400 dark:text-zinc-700 mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M21.75 6.75v10.5a2.25 2.25 0 01-2.25 2.25h-15a2.25 2.25 0 01-2.25-2.25V6.75m19.5 0A2.25 2.25 0 0019.5 4.5h-15a2.25 2.25 0 00-2.25 2.25m19.5 0v.243a2.25 2.25 0 01-1.07 1.916l-7.5 4.615a2.25 2.25 0 01-2.36 0L3.32 8.91a2.25 2.25 0 01-1.07-1.916V6.75" />
            </svg>
            <p className="text-zinc-500 dark:text-zinc-600 font-medium">No submissions match the current filters</p>
            <p className="text-zinc-400 dark:text-zinc-600 text-xs mt-1">Try clearing filters or adjusting your search terms</p>
            {hasActiveFilters && (
              <button
                onClick={clearAllFilters}
                className="mt-4 px-4 py-2 text-xs font-semibold text-zinc-800 dark:text-zinc-200 bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 dark:hover:bg-zinc-700 rounded-xl cursor-pointer"
              >
                Clear All Filters
              </button>
            )}
          </div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full text-sm perf-table">
                <thead>
                  <tr className="border-b border-zinc-200 dark:border-zinc-800 bg-slate-50 dark:bg-[#111114] select-none">
                    {/* Checkbox Column */}
                    {canWrite && (
                      <th className="w-10 px-4 py-4 text-center">
                        <input
                          type="checkbox"
                          checked={isAllVisibleSelected}
                          ref={(el) => {
                            if (el) el.indeterminate = isSomeVisibleSelected;
                          }}
                          onChange={toggleSelectAllVisible}
                          className="w-4 h-4 rounded border-zinc-300 dark:border-zinc-700 text-emerald-600 accent-emerald-600 cursor-pointer bg-white dark:bg-zinc-800"
                          title="Select all on this page"
                        />
                      </th>
                    )}

                    <th
                      onClick={() => handleSort("platform")}
                      className="text-left px-6 py-4 font-semibold text-zinc-700 dark:text-zinc-300 cursor-pointer hover:bg-slate-100 dark:hover:bg-[#1f1f24]"
                    >
                      <div className="flex items-center gap-1.5">
                        <span>Platform</span>
                        <span className="text-xs text-zinc-400">
                          {sortField === "platform" ? (sortOrder === "asc" ? "▲" : "▼") : "↕"}
                        </span>
                      </div>
                    </th>

                    <th
                      onClick={() => handleSort("name")}
                      className="text-left px-6 py-4 font-semibold text-zinc-700 dark:text-zinc-300 cursor-pointer hover:bg-slate-100 dark:hover:bg-[#1f1f24]"
                    >
                      <div className="flex items-center gap-1.5">
                        <span>Sender</span>
                        <span className="text-xs text-zinc-400">
                          {sortField === "name" ? (sortOrder === "asc" ? "▲" : "▼") : "↕"}
                        </span>
                      </div>
                    </th>

                    {/* Email Column Header */}
                    <th
                      onClick={() => handleSort("email")}
                      className="text-left px-6 py-4 font-semibold text-zinc-700 dark:text-zinc-300 cursor-pointer hover:bg-slate-100 dark:hover:bg-[#1f1f24]"
                    >
                      <div className="flex items-center gap-1.5">
                        <span>Email</span>
                        <span className="text-xs text-zinc-400">
                          {sortField === "email" ? (sortOrder === "asc" ? "▲" : "▼") : "↕"}
                        </span>
                      </div>
                    </th>

                    {/* Dedicated Domain Status Column Header */}
                    <th
                      onClick={() => handleSort("emailVerified")}
                      className="text-left px-6 py-4 font-semibold text-zinc-700 dark:text-zinc-300 cursor-pointer hover:bg-slate-100 dark:hover:bg-[#1f1f24]"
                    >
                      <div className="flex items-center gap-1.5">
                        <span>Domain Status</span>
                        <span className="text-xs text-zinc-400">
                          {sortField === "emailVerified" ? (sortOrder === "asc" ? "▲" : "▼") : "↕"}
                        </span>
                      </div>
                    </th>

                    <th className="text-left px-6 py-4 font-semibold text-zinc-700 dark:text-zinc-300">Message</th>

                    <th
                      onClick={() => handleSort("createdAt")}
                      className="text-left px-6 py-4 font-semibold text-zinc-700 dark:text-zinc-300 cursor-pointer hover:bg-slate-100 dark:hover:bg-[#1f1f24]"
                    >
                      <div className="flex items-center gap-1.5">
                        <span>Date</span>
                        <span className="text-xs text-zinc-400">
                          {sortField === "createdAt" ? (sortOrder === "asc" ? "▲" : "▼") : "↕"}
                        </span>
                      </div>
                    </th>

                    <th className="text-right px-6 py-4 font-semibold text-zinc-700 dark:text-zinc-300">Actions</th>
                  </tr>

                  {/* Inline Column Filters Row */}
                  {showColumnFilters && (
                    <tr className="border-b border-zinc-200 dark:border-zinc-800 bg-zinc-100 dark:bg-[#131316]">
                      {canWrite && <td className="px-4 py-2.5" />}
                      <td className="px-6 py-2.5">
                        <DropdownSelect
                          value={selectedPlatform}
                          onChange={(val) => { setSelectedPlatform(val); setPage(1); }}
                          options={[
                            { label: "All platforms", value: "all" },
                            ...platforms.map((p) => ({ label: p, value: p })),
                          ]}
                          size="sm"
                          align="left"
                          minWidth="160px"
                          className="w-full"
                        />
                      </td>
                      <td className="px-6 py-2.5">
                        <input
                          type="text"
                          placeholder="Filter sender..."
                          value={senderFilter}
                          onChange={(e) => setSenderFilter(e.target.value)}
                          className="w-full bg-white dark:bg-zinc-900 border border-zinc-300 dark:border-zinc-700 rounded-lg px-2 py-1 text-xs text-zinc-800 dark:text-zinc-200 placeholder:text-zinc-400 focus:outline-none focus:ring-1 focus:ring-zinc-400"
                        />
                      </td>
                      <td className="px-6 py-2.5">
                        <input
                          type="text"
                          placeholder="Filter email..."
                          value={emailFilter}
                          onChange={(e) => setEmailFilter(e.target.value)}
                          className="w-full bg-white dark:bg-zinc-900 border border-zinc-300 dark:border-zinc-700 rounded-lg px-2 py-1 text-xs text-zinc-800 dark:text-zinc-200 placeholder:text-zinc-400 focus:outline-none focus:ring-1 focus:ring-zinc-400"
                        />
                      </td>
                      <td className="px-6 py-2.5">
                        <DropdownSelect
                          value={domainStatusFilter}
                          onChange={(val) => { setDomainStatusFilter(val as "all" | "valid" | "invalid"); setPage(1); }}
                          options={[
                            { label: "All domains", value: "all" },
                            { label: "✓ Verified MX only", value: "valid" },
                            { label: "✕ Invalid domains only", value: "invalid" },
                          ]}
                          size="sm"
                          align="left"
                          minWidth="180px"
                          className="w-full"
                        />
                      </td>
                      <td className="px-6 py-2.5" colSpan={3}>
                        <div className="flex items-center justify-end">
                          <button
                            onClick={() => {
                              setSenderFilter("");
                              setEmailFilter("");
                              setSelectedPlatform("all");
                              setDomainStatusFilter("all");
                            }}
                            className="text-xs text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200 font-medium px-2 py-1 rounded bg-zinc-200 dark:bg-zinc-800"
                          >
                            Reset Column Filters
                          </button>
                        </div>
                      </td>
                    </tr>
                  )}
                </thead>
                <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
                  {enquiries.map((enq) => {
                    const isSelected = selectedIds.includes(enq.id);
                    return (
                      <tr
                        key={enq.id}
                        className={`hover:bg-slate-50 dark:hover:bg-[#151518] ${
                          isSelected ? "bg-emerald-100 dark:bg-[#0c2419]" : ""
                        }`}
                      >
                        {/* Checkbox */}
                        {canWrite && (
                          <td className="w-10 px-4 py-4 text-center">
                            <input
                              type="checkbox"
                              checked={isSelected}
                              onChange={() => toggleSelectRow(enq.id)}
                              className="w-4 h-4 rounded border-zinc-300 dark:border-zinc-700 text-emerald-600 accent-emerald-600 cursor-pointer bg-white dark:bg-zinc-800"
                            />
                          </td>
                        )}

                        {/* Platform */}
                        <td className="px-6 py-4">
                          <span className="inline-flex items-center px-2.5 py-1 rounded-lg text-xs font-semibold bg-zinc-100 dark:bg-zinc-800 text-zinc-800 dark:text-zinc-200 border border-zinc-200 dark:border-zinc-700 font-mono">
                            {enq.platform}
                          </span>
                        </td>

                        {/* Sender */}
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-2.5">
                            <div className="w-7 h-7 rounded-full bg-slate-100 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 flex items-center justify-center text-xs font-semibold text-zinc-700 dark:text-zinc-300 shrink-0">
                              {(enq.name || "U").charAt(0).toUpperCase()}
                            </div>
                            <span className="font-semibold text-zinc-900 dark:text-white truncate max-w-[140px]">{enq.name}</span>
                          </div>
                        </td>

                        {/* Email Column: ONLY EMAIL AS REQUESTED */}
                        <td className="px-6 py-4">
                          <span
                            className="font-mono text-xs font-medium text-zinc-900 dark:text-zinc-100 truncate block max-w-[220px]"
                            title={enq.email}
                          >
                            {enq.email}
                          </span>
                        </td>

                        {/* Dedicated Domain Status Column: BADGE SHOWN HERE */}
                        <td className="px-6 py-4 whitespace-nowrap">
                          {enq.emailVerified === true ? (
                            <span
                              title={`Valid mail server: ${enq.emailMx || "Verified"}`}
                              className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-50 dark:bg-[#0c2419] text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800"
                            >
                              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 shrink-0" />
                              Valid Domain
                            </span>
                          ) : enq.emailVerified === false ? (
                            <span
                              title="Domain does not exist or has no active mail server (RFC 7505 Null MX / unreachable)"
                              className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-red-50 dark:bg-[#280c10] text-red-700 dark:text-red-300 border border-red-200 dark:border-red-900"
                            >
                              <span className="w-1.5 h-1.5 rounded-full bg-red-500 shrink-0" />
                              Invalid Domain
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 border border-zinc-200 dark:border-zinc-700">
                              <span className="w-1.5 h-1.5 rounded-full bg-zinc-400 shrink-0" />
                              Unverified
                            </span>
                          )}
                        </td>

                        {/* Message */}
                        <td className="px-6 py-4 text-zinc-600 dark:text-zinc-400 max-w-xs truncate">
                          {enq.message}
                        </td>

                        {/* Date */}
                        <td className="px-6 py-4 text-zinc-500 text-xs whitespace-nowrap">
                          {new Date(enq.createdAt).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
                        </td>

                        {/* Actions */}
                        <td className="px-6 py-4">
                          <div className="flex items-center justify-end gap-2">
                            <button
                              onClick={() => setSelectedEnquiry(enq)}
                              className="text-zinc-700 dark:text-zinc-300 hover:text-zinc-900 dark:hover:text-white text-xs bg-white dark:bg-zinc-800 hover:bg-slate-100 dark:hover:bg-zinc-700 border border-zinc-200 dark:border-zinc-700 px-3 py-1.5 rounded-lg cursor-pointer shadow-2xs font-medium"
                            >
                              View
                            </button>
                            {canWrite && (
                              <button
                                onClick={() => setDeleteTarget(enq)}
                                disabled={deleting === enq.id}
                                className="text-zinc-500 hover:text-red-600 dark:text-zinc-400 dark:hover:text-red-400 text-xs bg-white dark:bg-zinc-800 hover:bg-red-50 dark:hover:bg-red-950/50 border border-zinc-200 dark:border-zinc-700 px-3 py-1.5 rounded-lg cursor-pointer disabled:opacity-40 shadow-2xs font-medium"
                              >
                                Delete
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Solid Color Compact Pagination Bar */}
            {pagination.total > 0 && (
              <div className="flex flex-col sm:flex-row items-center justify-between gap-4 px-6 py-3.5 border-t border-zinc-200 dark:border-[#27272a] bg-slate-50 dark:bg-[#111114]">
                {/* Left: Range Info */}
                <div className="text-xs text-zinc-600 dark:text-zinc-400 font-medium">
                  Showing <strong className="text-zinc-900 dark:text-white">{((pagination.page - 1) * pagination.limit) + 1}</strong>–<strong className="text-zinc-900 dark:text-white">{Math.min(pagination.page * pagination.limit, pagination.total)}</strong> of <strong className="text-zinc-900 dark:text-white">{pagination.total}</strong> submissions
                </div>

                {/* Center: Rows per page selector */}
                <div className="flex items-center gap-2 text-xs text-zinc-600 dark:text-zinc-400">
                  <span>Rows per page:</span>
                  <DropdownSelect
                    value={String(pageSize)}
                    onChange={(val) => {
                      setPageSize(Number(val));
                      setPage(1);
                      scrollToTop();
                    }}
                    options={[
                      { label: "5", value: "5" },
                      { label: "10", value: "10" },
                      { label: "15", value: "15" },
                      { label: "20", value: "20" },
                      { label: "50", value: "50" },
                    ]}
                    size="sm"
                    direction="up"
                    minWidth="70px"
                    className="w-16"
                  />
                </div>

                {/* Right: Page Navigation Buttons */}
                <div className="flex items-center gap-1.5">
                  {/* First Page */}
                  <button
                    onClick={() => { setPage(1); scrollToTop(); }}
                    disabled={page === 1}
                    className="px-2 py-1.5 text-xs font-medium text-zinc-700 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white bg-white dark:bg-[#18181b] hover:bg-zinc-100 dark:hover:bg-[#222226] border border-zinc-200 dark:border-[#27272a] disabled:opacity-30 disabled:cursor-not-allowed rounded-lg cursor-pointer"
                    title="First Page"
                  >
                    «
                  </button>

                  {/* Previous Page */}
                  <button
                    onClick={() => { setPage(Math.max(1, page - 1)); scrollToTop(); }}
                    disabled={page === 1}
                    className="px-3 py-1.5 text-xs font-medium text-zinc-700 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white bg-white dark:bg-[#18181b] hover:bg-zinc-100 dark:hover:bg-[#222226] border border-zinc-200 dark:border-[#27272a] disabled:opacity-30 disabled:cursor-not-allowed rounded-lg cursor-pointer flex items-center gap-1"
                  >
                    <span>‹</span> Prev
                  </button>

                  {/* Numbered Page Buttons */}
                  <div className="flex items-center gap-1">
                    {getPageNumbers(page, pagination.totalPages).map((p, idx) => {
                      if (p === "...") {
                        return (
                          <span key={`ellipsis-${idx}`} className="px-1 text-xs text-zinc-400">
                            ...
                          </span>
                        );
                      }
                      const pageNum = p as number;
                      const isCurrent = pageNum === page;
                      return (
                        <button
                          key={pageNum}
                          onClick={() => { setPage(pageNum); scrollToTop(); }}
                          className={`w-7 h-7 text-xs font-semibold rounded-lg cursor-pointer transition-colors ${
                            isCurrent
                              ? "bg-blue-600 text-white font-bold shadow-xs border border-blue-600"
                              : "text-zinc-700 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white bg-white dark:bg-zinc-900 hover:bg-zinc-100 dark:hover:bg-zinc-800 border border-zinc-200 dark:border-zinc-800"
                          }`}
                        >
                          {pageNum}
                        </button>
                      );
                    })}
                  </div>

                  {/* Next Page */}
                  <button
                    onClick={() => { setPage(Math.min(pagination.totalPages, page + 1)); scrollToTop(); }}
                    disabled={page === pagination.totalPages || pagination.totalPages === 0}
                    className="px-3 py-1.5 text-xs font-medium text-zinc-700 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white bg-white dark:bg-[#18181b] hover:bg-zinc-100 dark:hover:bg-[#222226] border border-zinc-200 dark:border-[#27272a] disabled:opacity-30 disabled:cursor-not-allowed rounded-lg cursor-pointer flex items-center gap-1"
                  >
                    Next <span>›</span>
                  </button>

                  {/* Last Page */}
                  <button
                    onClick={() => { setPage(pagination.totalPages); scrollToTop(); }}
                    disabled={page === pagination.totalPages || pagination.totalPages === 0}
                    className="px-2 py-1.5 text-xs font-medium text-zinc-700 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white bg-white dark:bg-[#18181b] hover:bg-zinc-100 dark:hover:bg-[#222226] border border-zinc-200 dark:border-[#27272a] disabled:opacity-30 disabled:cursor-not-allowed rounded-lg cursor-pointer"
                    title="Last Page"
                  >
                    »
                  </button>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </>
  ) : (
    <div className="space-y-4">
      {/* FormBridge Project Selector Card */}
      <div className="bg-white dark:bg-[#111114] border border-zinc-200 dark:border-zinc-800 rounded-2xl p-4 sm:p-5 shadow-xs">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-blue-500 animate-pulse" />
              <h3 className="text-sm font-bold text-zinc-900 dark:text-white uppercase tracking-wider">
                Select Form Project
              </h3>
              <span className="px-2 py-0.5 rounded-full text-[11px] font-medium bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/20">
                {fbProjects.length} {fbProjects.length === 1 ? "project" : "projects"}
              </span>
            </div>
            <p className="text-xs text-zinc-500 dark:text-zinc-400">
              Each form has its own custom schema fields and independent submission records.
            </p>
          </div>

          {/* Quick actions & Link to FormBridge */}
          <div className="flex items-center gap-2">
            <Link
              href={selectedFbProject ? `/admin/forms?project=${selectedFbProject.id}` : "/admin/forms"}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-zinc-700 dark:text-zinc-300 hover:text-zinc-900 dark:hover:text-white bg-slate-100 dark:bg-zinc-800/80 hover:bg-slate-200 dark:hover:bg-zinc-700 border border-zinc-200 dark:border-zinc-700 rounded-xl transition-all cursor-pointer shadow-2xs"
              title="Open FormBridge builder for this project"
            >
              <svg className="w-3.5 h-3.5 text-blue-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 6H5.25A2.25 2.25 0 003 8.25v10.5A2.25 2.25 0 005.25 21h10.5A2.25 2.25 0 0018 18.75V10.5m-10.5 6L21 3m0 0h-5.25M21 3v5.25" />
              </svg>
              FormBridge Designer
            </Link>
            <button
              onClick={() => {
                fetchFbProjects();
                if (selectedFbProjectId) fetchFbSubmissions(selectedFbProjectId, fbPage, 10);
              }}
              className="p-2 text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white bg-slate-100 dark:bg-zinc-800/80 hover:bg-slate-200 dark:hover:bg-zinc-700 border border-zinc-200 dark:border-zinc-700 rounded-xl transition-all cursor-pointer shadow-2xs"
              title="Refresh submissions"
            >
              <svg className={`w-3.5 h-3.5 ${fbLoading ? "animate-spin" : ""}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0l3.181 3.183a8.25 8.25 0 0013.803-3.7M4.031 9.865a8.25 8.25 0 0113.803-3.7l3.181 3.182m0-4.991v4.99" />
              </svg>
            </button>
          </div>
        </div>

        {/* Project Pills List */}
        {fbProjects.length === 0 ? (
          <div className="mt-4 p-4 rounded-xl bg-zinc-50 dark:bg-zinc-900/50 border border-zinc-200 dark:border-zinc-800 text-center">
            <p className="text-xs text-zinc-500 dark:text-zinc-400 font-medium">No FormBridge projects found.</p>
            <Link
              href="/admin/forms"
              className="mt-2 inline-flex items-center gap-1 text-xs font-semibold text-blue-600 dark:text-blue-400 hover:underline"
            >
              Create your first form in FormBridge →
            </Link>
          </div>
        ) : (
          <div className="mt-4 flex flex-wrap items-center gap-2">
            {fbProjects.map((p) => {
              const isSelected = p.id === selectedFbProjectId || p.slug === selectedFbProjectId;
              const fieldCount = p.schema?.fields?.length || (p.useDefaultSchema ? 5 : 0);
              return (
                <button
                  key={p.id}
                  onClick={() => {
                    setSelectedFbProjectId(p.id);
                    setFbPage(1);
                  }}
                  className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-semibold transition-all cursor-pointer shadow-xs ${
                    isSelected
                      ? "bg-blue-600 text-white shadow-blue-500/25 shadow-md border border-blue-600"
                      : "bg-slate-50 dark:bg-zinc-900/80 text-zinc-700 dark:text-zinc-300 hover:bg-slate-100 dark:hover:bg-zinc-800 border border-zinc-200 dark:border-zinc-800"
                  }`}
                >
                  <span>{p.name}</span>
                  <span
                    className={`px-1.5 py-0.5 rounded-full text-[10px] font-bold ${
                      isSelected
                        ? "bg-white/20 text-white"
                        : "bg-zinc-200/70 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400"
                    }`}
                  >
                    {p._count?.submissions || 0}
                  </span>
                  {fieldCount > 0 && (
                    <span
                      className={`text-[10px] hidden sm:inline ${
                        isSelected ? "text-blue-200" : "text-zinc-400 dark:text-zinc-500"
                      }`}
                    >
                      ({fieldCount} fields)
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        )}

        {/* Active Project Endpoint Pill */}
        {selectedFbProject && (
          <div className="mt-4 pt-3.5 border-t border-zinc-100 dark:border-zinc-800/80 flex flex-wrap items-center justify-between gap-3 text-xs">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-zinc-500 dark:text-zinc-400 font-medium">Submission Endpoint:</span>
              <code className="px-2 py-0.5 rounded-lg bg-zinc-100 dark:bg-zinc-900 text-zinc-800 dark:text-zinc-200 font-mono text-[11px] border border-zinc-200 dark:border-zinc-800">
                POST /api/forms/{selectedFbProject.slug}/submit
              </code>
              <button
                onClick={() => {
                  if (typeof window !== "undefined") {
                    const url = `${window.location.origin}/api/forms/${selectedFbProject.slug}/submit`;
                    navigator.clipboard.writeText(url);
                    setCopiedKey(selectedFbProject.slug);
                    setTimeout(() => setCopiedKey(null), 2000);
                  }
                }}
                className="px-2 py-0.5 rounded text-[11px] font-medium text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-950/40 cursor-pointer transition"
              >
                {copiedKey === selectedFbProject.slug ? "✓ Copied!" : "Copy Full URL"}
              </button>
            </div>
            <div className="text-[11px] text-zinc-400 dark:text-zinc-500">
              Schema: <strong className="text-zinc-700 dark:text-zinc-300">{allDisplayColumns.length} dynamic columns</strong>
            </div>
          </div>
        )}
      </div>

      {/* FormBridge Filter & Search Bar */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <svg className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-400 dark:text-zinc-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z" />
          </svg>
          <input
            type="text"
            placeholder={`Search across ${allDisplayColumns.map((c) => c.label).slice(0, 3).join(", ") || "fields"}...`}
            value={fbSearch}
            onChange={(e) => setFbSearch(e.target.value)}
            className="w-full bg-white dark:bg-[#111114] border border-zinc-200 dark:border-zinc-800 rounded-xl pl-10 pr-4 py-2.5 text-xs text-zinc-900 dark:text-zinc-200 placeholder:text-zinc-400 dark:placeholder:text-zinc-500 focus:outline-none focus:border-zinc-400 dark:focus:border-zinc-600 transition shadow-xs"
          />
        </div>

        <DropdownSelect
          value={fbDomainFilter}
          onChange={(val) => setFbDomainFilter(val as "all" | "valid" | "invalid")}
          options={[
            { label: `All Domains (${fbSubmissions.length})`, value: "all" },
            {
              label: `✓ Valid Domains (${fbSubmissions.filter((s) => s.emailVerified === true).length})`,
              value: "valid",
            },
            {
              label: `✕ Invalid Domains (${fbSubmissions.filter((s) => s.emailVerified === false).length})`,
              value: "invalid",
            },
          ]}
          className="w-full sm:w-56 shrink-0"
          align="right"
          minWidth="200px"
        />

        {(fbSearch || fbDomainFilter !== "all") && (
          <button
            onClick={() => {
              setFbSearch("");
              setFbDomainFilter("all");
            }}
            className="flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-zinc-700 dark:text-zinc-300 hover:text-red-600 dark:hover:text-red-400 bg-white dark:bg-[#111114] hover:bg-zinc-100 dark:hover:bg-zinc-800 border border-zinc-200 dark:border-zinc-800 rounded-xl transition cursor-pointer shadow-xs shrink-0"
          >
            Reset
          </button>
        )}
      </div>

      {/* FormBridge Dynamic Schema Table */}
      <div className="bg-white dark:bg-[#111114] border border-zinc-200 dark:border-zinc-800 rounded-2xl overflow-hidden shadow-xs">
        {fbLoading ? (
          <div className="flex items-center justify-center py-20">
            <div className="w-6 h-6 border-2 border-zinc-400 dark:border-zinc-600 border-t-zinc-900 dark:border-t-zinc-300 rounded-full animate-spin" />
          </div>
        ) : filteredFbSubmissions.length === 0 ? (
          <div className="text-center py-20 px-4">
            <svg className="w-12 h-12 mx-auto text-zinc-400 dark:text-zinc-600 mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
            </svg>
            <p className="text-zinc-700 dark:text-zinc-300 font-semibold text-sm">
              No submissions found for {selectedFbProject?.name || "this form"}
            </p>
            <p className="text-zinc-400 dark:text-zinc-500 text-xs mt-1 max-w-md mx-auto">
              {fbSearch || fbDomainFilter !== "all"
                ? "Try clearing your search query or domain filter."
                : "FormBridge will capture submissions sent to this form's endpoint in real-time."}
            </p>
            {selectedFbProject && (
              <div className="mt-4 inline-flex items-center gap-2 px-3 py-1.5 rounded-lg bg-zinc-100 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 text-xs font-mono text-zinc-600 dark:text-zinc-400">
                POST /api/forms/{selectedFbProject.slug}/submit
              </div>
            )}
          </div>
        ) : (
          <>
            <div className="overflow-x-auto max-w-full">
              <table className="w-full text-sm perf-table">
                <thead>
                  <tr className="border-b border-zinc-200 dark:border-zinc-800 bg-slate-50 dark:bg-[#111114] select-none">
                    {/* Dynamic Schema Columns */}
                    {allDisplayColumns.map((col) => (
                      <th
                        key={col.key}
                        className="px-6 py-4 text-left text-xs font-bold text-zinc-700 dark:text-zinc-300 whitespace-nowrap"
                      >
                        <div className="flex items-center gap-1.5">
                          <span>{col.label}</span>
                          <span className="px-1.5 py-0.5 rounded text-[10px] font-mono uppercase bg-zinc-200/60 dark:bg-zinc-800 text-zinc-500 dark:text-zinc-400 font-normal">
                            {col.type || "text"}
                          </span>
                        </div>
                      </th>
                    ))}

                    {/* Domain Status */}
                    <th className="px-6 py-4 text-left text-xs font-bold text-zinc-700 dark:text-zinc-300 whitespace-nowrap">
                      Domain Status
                    </th>

                    {/* Date */}
                    <th className="px-6 py-4 text-left text-xs font-bold text-zinc-700 dark:text-zinc-300 whitespace-nowrap">
                      Submitted
                    </th>

                    {/* Actions */}
                    <th className="px-6 py-4 text-right text-xs font-bold text-zinc-700 dark:text-zinc-300 whitespace-nowrap">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-200 dark:divide-zinc-800">
                  {filteredFbSubmissions.map((sub) => (
                    <tr
                      key={sub.id}
                      className="hover:bg-slate-50 dark:hover:bg-zinc-900/50 transition-colors"
                    >
                      {/* Dynamic Schema Column Values */}
                      {allDisplayColumns.map((col) => {
                        const val = sub.data?.[col.key];
                        const isEmpty = val === undefined || val === null || val === "";
                        const isEmail =
                          col.type === "email" ||
                          (typeof val === "string" && val.includes("@") && !val.includes(" "));
                        const isPassword = col.key.toLowerCase().includes("password");

                        return (
                          <td key={col.key} className="px-6 py-4 whitespace-nowrap">
                            {isEmpty ? (
                              <span className="text-zinc-300 dark:text-zinc-600 font-mono text-xs">
                                —
                              </span>
                            ) : isEmail ? (
                              <span
                                className="font-mono text-xs font-medium text-zinc-900 dark:text-zinc-100 truncate block max-w-[220px]"
                                title={String(val)}
                              >
                                {String(val)}
                              </span>
                            ) : isPassword ? (
                              <span
                                className="font-mono text-xs text-zinc-700 dark:text-zinc-300 bg-zinc-100 dark:bg-zinc-800/80 px-2 py-0.5 rounded border border-zinc-200/60 dark:border-zinc-700/60 truncate block max-w-[180px]"
                                title={String(val)}
                              >
                                {String(val)}
                              </span>
                            ) : typeof val === "boolean" ? (
                              <span
                                className={`px-2 py-0.5 rounded text-[11px] font-semibold ${
                                  val
                                    ? "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400"
                                    : "bg-zinc-200 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400"
                                }`}
                              >
                                {val ? "Yes" : "No"}
                              </span>
                            ) : typeof val === "object" ? (
                              <span
                                className="font-mono text-[11px] text-zinc-500 truncate block max-w-[200px]"
                                title={JSON.stringify(val)}
                              >
                                {JSON.stringify(val)}
                              </span>
                            ) : (
                              <span
                                className="text-xs text-zinc-800 dark:text-zinc-200 truncate block max-w-[220px]"
                                title={String(val)}
                              >
                                {String(val)}
                              </span>
                            )}
                          </td>
                        );
                      })}

                      {/* Domain Status */}
                      <td className="px-6 py-4 whitespace-nowrap">
                        {sub.emailVerified === true ? (
                          <span
                            title={`Valid mail server: ${sub.emailMx || "Verified"}`}
                            className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-50 dark:bg-[#0c2419] text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800"
                          >
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 shrink-0" />
                            Valid Domain
                          </span>
                        ) : sub.emailVerified === false ? (
                          <span
                            title="Domain failed DNS MX verification"
                            className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-red-50 dark:bg-[#280c10] text-red-700 dark:text-red-300 border border-red-200 dark:border-red-900"
                          >
                            <span className="w-1.5 h-1.5 rounded-full bg-red-500 shrink-0" />
                            Invalid Domain
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 border border-zinc-200 dark:border-zinc-700">
                            <span className="w-1.5 h-1.5 rounded-full bg-zinc-400 shrink-0" />
                            Unverified
                          </span>
                        )}
                      </td>

                      {/* Date */}
                      <td className="px-6 py-4 text-zinc-500 text-xs whitespace-nowrap">
                        <div>{new Date(sub.createdAt).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}</div>
                        <div className="text-[11px] text-zinc-400 font-mono">
                          {new Date(sub.createdAt).toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" })}
                        </div>
                      </td>

                      {/* Actions */}
                      <td className="px-6 py-4 whitespace-nowrap text-right">
                        <div className="flex items-center justify-end gap-2">
                          <button
                            onClick={() => setSelectedFbSubmission(sub)}
                            className="text-zinc-700 dark:text-zinc-300 hover:text-zinc-900 dark:hover:text-white text-xs bg-white dark:bg-zinc-800 hover:bg-slate-100 dark:hover:bg-zinc-700 border border-zinc-200 dark:border-zinc-700 px-3 py-1.5 rounded-lg cursor-pointer shadow-2xs font-medium"
                          >
                            View
                          </button>
                          {canWrite && (
                            <button
                              onClick={() => handleDeleteFbSubmission(sub.id)}
                              disabled={deletingFbId === sub.id}
                              className="text-zinc-500 hover:text-red-600 dark:text-zinc-400 dark:hover:text-red-400 text-xs bg-white dark:bg-zinc-800 hover:bg-red-50 dark:hover:bg-red-950/50 border border-zinc-200 dark:border-zinc-700 px-3 py-1.5 rounded-lg cursor-pointer disabled:opacity-40 shadow-2xs font-medium"
                            >
                              {deletingFbId === sub.id ? "..." : "Delete"}
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* FormBridge Pagination Bar */}
            {fbPagination.total > 0 && (
              <div className="flex flex-col sm:flex-row items-center justify-between gap-4 px-6 py-3.5 border-t border-zinc-200 dark:border-[#27272a] bg-slate-50 dark:bg-[#111114]">
                <div className="text-xs text-zinc-600 dark:text-zinc-400 font-medium">
                  Showing <strong className="text-zinc-900 dark:text-white">{((fbPagination.page - 1) * fbPagination.limit) + 1}</strong>–<strong className="text-zinc-900 dark:text-white">{Math.min(fbPagination.page * fbPagination.limit, fbPagination.total)}</strong> of <strong className="text-zinc-900 dark:text-white">{fbPagination.total}</strong> submissions
                </div>
                <div className="flex items-center gap-1.5">
                  <button
                    onClick={() => {
                      const newPage = Math.max(1, fbPage - 1);
                      setFbPage(newPage);
                      fetchFbSubmissions(selectedFbProjectId, newPage, 10);
                    }}
                    disabled={fbPage === 1}
                    className="px-3 py-1.5 text-xs font-medium text-zinc-700 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white bg-white dark:bg-[#18181b] hover:bg-zinc-100 dark:hover:bg-[#222226] border border-zinc-200 dark:border-[#27272a] disabled:opacity-30 disabled:cursor-not-allowed rounded-lg cursor-pointer"
                  >
                    ‹ Prev
                  </button>
                  <span className="px-3 py-1 text-xs font-semibold text-zinc-900 dark:text-white">
                    Page {fbPage} of {fbPagination.totalPages || 1}
                  </span>
                  <button
                    onClick={() => {
                      const newPage = Math.min(fbPagination.totalPages, fbPage + 1);
                      setFbPage(newPage);
                      fetchFbSubmissions(selectedFbProjectId, newPage, 10);
                    }}
                    disabled={fbPage >= fbPagination.totalPages}
                    className="px-3 py-1.5 text-xs font-medium text-zinc-700 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white bg-white dark:bg-[#18181b] hover:bg-zinc-100 dark:hover:bg-[#222226] border border-zinc-200 dark:border-[#27272a] disabled:opacity-30 disabled:cursor-not-allowed rounded-lg cursor-pointer"
                  >
                    Next ›
                  </button>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )}

      {/* Submission Detail Modal rendered directly in body via Portal */}
      {mounted && selectedEnquiry && createPortal(
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4 sm:p-6 overflow-y-auto"
          onClick={() => setSelectedEnquiry(null)}
        >
          <div
            className="bg-white dark:bg-[#111114] border border-zinc-200 dark:border-zinc-800 rounded-2xl w-full max-w-lg shadow-2xl overflow-hidden my-auto flex flex-col max-h-[90vh] animate-in zoom-in-95 duration-150"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between px-6 py-4 border-b border-zinc-200 dark:border-zinc-800 shrink-0 bg-white dark:bg-[#111114]">
              <div className="flex items-center gap-2.5">
                <span className="px-2.5 py-0.5 rounded-md text-xs font-semibold bg-zinc-100 dark:bg-zinc-800 text-zinc-800 dark:text-zinc-200 border border-zinc-200 dark:border-zinc-700 font-mono">
                  {selectedEnquiry.platform}
                </span>
                <h2 className="text-base font-semibold text-zinc-900 dark:text-white">Submission Details</h2>
              </div>
              <button
                onClick={() => setSelectedEnquiry(null)}
                aria-label="Close modal"
                className="text-zinc-500 hover:text-zinc-900 dark:hover:text-white text-xl leading-none cursor-pointer w-8 h-8 flex items-center justify-center rounded-lg hover:bg-zinc-100 dark:hover:bg-zinc-800"
              >
                &times;
              </button>
            </div>

            <div className="px-6 py-5 space-y-4 overflow-y-auto overscroll-contain flex-1">
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <span className="text-zinc-400 text-xs block mb-1">Name</span>
                  <span className="font-semibold text-zinc-900 dark:text-white">{selectedEnquiry.name}</span>
                </div>
                <div>
                  <span className="text-zinc-400 text-xs block mb-1">Email</span>
                  <a href={`mailto:${selectedEnquiry.email}`} className="font-semibold text-indigo-600 dark:text-indigo-400 hover:underline break-all">
                    {selectedEnquiry.email}
                  </a>
                </div>
                {selectedEnquiry.phone && (
                  <div>
                    <span className="text-zinc-400 text-xs block mb-1">Phone</span>
                    <span className="font-medium text-zinc-900 dark:text-white">{selectedEnquiry.phone}</span>
                  </div>
                )}
                {selectedEnquiry.subject && (
                  <div>
                    <span className="text-zinc-400 text-xs block mb-1">Subject</span>
                    <span className="font-medium text-zinc-900 dark:text-white">{selectedEnquiry.subject}</span>
                  </div>
                )}
              </div>

              {/* Auto DNS Mail Verification Box */}
              <div
                className={`p-3.5 rounded-xl border text-xs font-sans ${
                  verifyingEmail
                    ? "bg-zinc-50 dark:bg-zinc-900 border-zinc-200 dark:border-zinc-800 text-zinc-600 dark:text-zinc-400"
                    : verificationResult?.valid
                    ? "bg-emerald-50 dark:bg-[#0c2419] border-emerald-300 dark:border-[#065f46] text-emerald-900 dark:text-[#34d399]"
                    : "bg-red-50 dark:bg-[#280c10] border-red-300 dark:border-[#7f1d1d] text-red-900 dark:text-[#f87171]"
                }`}
              >
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-2 font-semibold">
                    {verifyingEmail ? (
                      <>
                        <div className="w-3.5 h-3.5 border-2 border-zinc-400 border-t-zinc-700 dark:border-t-zinc-200 rounded-full animate-spin shrink-0" />
                        <span>Verifying Mail Server DNS (MX)...</span>
                      </>
                    ) : verificationResult?.valid ? (
                      <>
                        <span className="w-4 h-4 rounded-full bg-emerald-600 text-white flex items-center justify-center text-[10px] font-bold shrink-0">
                          ✓
                        </span>
                        <span>Mailbox Domain Exists (DNS MX Verified)</span>
                      </>
                    ) : (
                      <>
                        <span className="w-4 h-4 rounded-full bg-red-600 text-white flex items-center justify-center text-[10px] font-bold shrink-0">
                          ✕
                        </span>
                        <span>Invalid / Non-Existent Mail Domain</span>
                      </>
                    )}
                  </div>

                  <button
                    onClick={() => runEmailVerification(selectedEnquiry.email)}
                    disabled={verifyingEmail}
                    className="px-2.5 py-1 text-[11px] font-medium rounded-lg bg-white dark:bg-zinc-800 hover:bg-zinc-100 dark:hover:bg-zinc-700 text-zinc-700 dark:text-zinc-300 border border-zinc-200 dark:border-zinc-700 cursor-pointer disabled:opacity-50 shrink-0"
                  >
                    {verifyingEmail ? "Verifying..." : "Re-check DNS"}
                  </button>
                </div>

                {!verifyingEmail && verificationResult && (
                  <div className="mt-2.5 pt-2 border-t border-zinc-200 dark:border-[#27272a] text-[11px] space-y-1">
                    {verificationResult.valid ? (
                      <>
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span className="text-emerald-700 dark:text-emerald-400 font-medium">Primary Mail Exchange:</span>
                          <span className="font-mono bg-emerald-100 dark:bg-[#0c2419] px-1.5 py-0.5 rounded text-[10px] font-semibold text-emerald-800 dark:text-emerald-200 border border-emerald-200 dark:border-[#065f46]">
                            {verificationResult.primaryMx || "A Record Fallback"}
                          </span>
                        </div>
                        {verificationResult.mxRecords && verificationResult.mxRecords.length > 0 && (
                          <div className="text-zinc-500 dark:text-zinc-400 text-[10px]">
                            {verificationResult.mxRecords.length} active MX {verificationResult.mxRecords.length === 1 ? "server" : "servers"} discovered for @{verificationResult.domain}
                          </div>
                        )}
                      </>
                    ) : (
                      <div className="text-red-700 dark:text-red-300">
                        Reason: <span className="font-medium">{verificationResult.reason || "Domain does not exist or has no active mail servers"}</span>
                      </div>
                    )}
                  </div>
                )}
              </div>

              <div>
                <span className="text-zinc-400 text-xs block mb-1.5">Message</span>
                <div className="bg-slate-50 dark:bg-[#18181c] border border-zinc-200 dark:border-zinc-800 rounded-xl p-4 text-sm text-zinc-800 dark:text-zinc-200 whitespace-pre-wrap leading-relaxed font-sans">
                  {selectedEnquiry.message}
                </div>
              </div>

              <div className="pt-2 border-t border-zinc-100 dark:border-zinc-800 flex items-center justify-between text-xs text-zinc-500">
                <span>Received: {new Date(selectedEnquiry.createdAt).toLocaleString()}</span>
              </div>
            </div>

            <div className="flex justify-between items-center px-6 py-4 border-t border-zinc-200 dark:border-zinc-800 bg-slate-50 dark:bg-[#161619] shrink-0">
              {canWrite && (
                <button
                  onClick={() => setSelectedEnquiry(null)}
                  className="text-xs font-semibold text-red-600 hover:text-red-700 dark:text-red-400 dark:hover:text-red-300 cursor-pointer"
                >
                  Close
                </button>
              )}
              <button
                onClick={() => setSelectedEnquiry(null)}
                className="btn-primary px-4 py-2 text-xs ml-auto"
              >
                Done
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* Single Delete Confirmation Modal */}
      {mounted && deleteTarget && createPortal(
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4 animate-in fade-in duration-150"
          onClick={() => setDeleteTarget(null)}
        >
          <div
            className="bg-white dark:bg-[#111114] border border-zinc-200 dark:border-zinc-800 rounded-2xl w-full max-w-sm shadow-2xl p-6 text-center space-y-4 animate-in zoom-in-95 duration-150 my-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="w-12 h-12 rounded-full bg-red-100 dark:bg-red-950 text-red-600 dark:text-red-400 mx-auto flex items-center justify-center border border-red-200 dark:border-red-900">
              <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
              </svg>
            </div>
            <div>
              <h3 className="text-base font-bold text-zinc-900 dark:text-white">Delete Submission?</h3>
              <p className="text-xs text-zinc-500 mt-1">
                Are you sure you want to delete the submission from <span className="font-semibold text-zinc-800 dark:text-zinc-200">{deleteTarget.name}</span>? This action cannot be undone.
              </p>
            </div>
            <div className="flex gap-3 pt-2">
              <button
                onClick={() => setDeleteTarget(null)}
                disabled={Boolean(deleting)}
                className="flex-1 px-4 py-2.5 text-xs font-semibold text-zinc-700 dark:text-zinc-300 bg-slate-100 dark:bg-zinc-800 hover:bg-slate-200 dark:hover:bg-zinc-700 rounded-xl cursor-pointer"
              >
                Cancel
              </button>
              <button
                onClick={confirmDelete}
                disabled={Boolean(deleting)}
                className="flex-1 px-4 py-2.5 text-xs font-semibold text-white bg-red-600 hover:bg-red-700 rounded-xl cursor-pointer shadow-sm disabled:opacity-50"
              >
                {deleting ? "Deleting..." : "Delete"}
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* Bulk Delete Confirmation Modal */}
      {mounted && bulkDeleteConfirm?.isOpen && createPortal(
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4 animate-in fade-in duration-150"
          onClick={() => setBulkDeleteConfirm(null)}
        >
          <div
            className="bg-white dark:bg-[#111114] border border-zinc-200 dark:border-zinc-800 rounded-2xl w-full max-w-md shadow-2xl p-6 text-center space-y-4 animate-in zoom-in-95 duration-150 my-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="w-12 h-12 rounded-full bg-red-100 dark:bg-red-950 text-red-600 dark:text-red-400 mx-auto flex items-center justify-center border border-red-200 dark:border-red-900">
              <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0" />
              </svg>
            </div>
            <div>
              <h3 className="text-base font-bold text-zinc-900 dark:text-white">
                {bulkDeleteConfirm.type === "all_invalid"
                  ? `Delete All ${bulkDeleteConfirm.count} Invalid Domain Submissions?`
                  : `Delete ${bulkDeleteConfirm.count} Selected Submissions?`}
              </h3>
              <p className="text-xs text-zinc-500 mt-2 leading-relaxed">
                {bulkDeleteConfirm.type === "all_invalid"
                  ? `Are you sure you want to permanently delete all ${bulkDeleteConfirm.count} contact submissions whose email domains failed DNS MX verification? This cannot be undone.`
                  : `Are you sure you want to permanently delete the ${bulkDeleteConfirm.count} selected submissions? This action cannot be undone.`}
              </p>
            </div>
            <div className="flex gap-3 pt-2">
              <button
                onClick={() => setBulkDeleteConfirm(null)}
                disabled={bulkDeleting}
                className="flex-1 px-4 py-2.5 text-xs font-semibold text-zinc-700 dark:text-zinc-300 bg-slate-100 dark:bg-zinc-800 hover:bg-slate-200 dark:hover:bg-zinc-700 rounded-xl cursor-pointer"
              >
                Cancel
              </button>
              <button
                onClick={executeBulkDelete}
                disabled={bulkDeleting}
                className="flex-1 px-4 py-2.5 text-xs font-semibold text-white bg-red-600 hover:bg-red-700 rounded-xl cursor-pointer shadow-sm disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {bulkDeleting ? (
                  <>
                    <div className="w-3.5 h-3.5 border-2 border-zinc-400 border-t-white rounded-full animate-spin" />
                    <span>Deleting...</span>
                  </>
                ) : (
                  `Delete ${bulkDeleteConfirm.count}`
                )}
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* FormBridge Submission Detail Modal rendered via Portal */}
      {mounted && selectedFbSubmission && createPortal(
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4 sm:p-6 overflow-y-auto"
          onClick={() => setSelectedFbSubmission(null)}
        >
          <div
            className="bg-white dark:bg-[#111114] border border-zinc-200 dark:border-zinc-800 rounded-2xl w-full max-w-2xl shadow-2xl overflow-hidden my-auto flex flex-col max-h-[90vh] animate-in zoom-in-95 duration-150"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-zinc-200 dark:border-zinc-800 shrink-0 bg-white dark:bg-[#111114]">
              <div className="flex items-center gap-2.5">
                <span className="px-2.5 py-0.5 rounded-md text-xs font-semibold bg-blue-50 dark:bg-blue-950/50 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-800">
                  {selectedFbProject?.name || "FormBridge"}
                </span>
                <span className="text-xs text-zinc-400 font-mono">
                  {selectedFbSubmission.id.slice(0, 10)}...
                </span>
              </div>
              <button
                onClick={() => setSelectedFbSubmission(null)}
                className="text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200 text-lg leading-none cursor-pointer p-1 rounded-lg hover:bg-zinc-100 dark:hover:bg-zinc-800 transition"
              >
                ✕
              </button>
            </div>

            {/* Modal Tabs */}
            <div className="flex items-center border-b border-zinc-200 dark:border-zinc-800 px-6 bg-slate-50 dark:bg-zinc-900/50 shrink-0">
              <button
                onClick={() => setFbModalTab("fields")}
                className={`py-3 px-4 text-xs font-bold border-b-2 transition cursor-pointer ${
                  fbModalTab === "fields"
                    ? "border-blue-600 text-blue-600 dark:text-blue-400"
                    : "border-transparent text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200"
                }`}
              >
                Structured Fields ({Object.keys(selectedFbSubmission.data || {}).length})
              </button>
              <button
                onClick={() => setFbModalTab("json")}
                className={`py-3 px-4 text-xs font-bold border-b-2 transition cursor-pointer ${
                  fbModalTab === "json"
                    ? "border-blue-600 text-blue-600 dark:text-blue-400"
                    : "border-transparent text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200"
                }`}
              >
                Raw JSON Payload
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-6 overflow-y-auto space-y-5 flex-1">
              {fbModalTab === "fields" ? (
                <div className="space-y-3">
                  {allDisplayColumns.map((col) => {
                    const val = selectedFbSubmission.data?.[col.key];
                    const isEmpty = val === undefined || val === null || val === "";
                    return (
                      <div
                        key={col.key}
                        className="bg-slate-50 dark:bg-[#18181b] border border-zinc-200 dark:border-zinc-800 rounded-xl p-3.5 flex flex-col gap-1"
                      >
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-bold text-zinc-700 dark:text-zinc-300">
                            {col.label}
                          </span>
                          <span className="text-[10px] font-mono uppercase text-zinc-400 dark:text-zinc-500 bg-zinc-200/60 dark:bg-zinc-800 px-1.5 py-0.5 rounded">
                            {col.key}
                          </span>
                        </div>
                        <div className="mt-1">
                          {isEmpty ? (
                            <span className="text-zinc-400 dark:text-zinc-600 italic text-xs">Empty</span>
                          ) : typeof val === "object" ? (
                            <pre className="text-xs font-mono bg-zinc-100 dark:bg-black/50 p-2.5 rounded-lg overflow-x-auto text-zinc-800 dark:text-zinc-200">
                              {JSON.stringify(val, null, 2)}
                            </pre>
                          ) : (
                            <p className="text-xs text-zinc-900 dark:text-zinc-100 font-medium select-text break-words whitespace-pre-wrap">
                              {String(val)}
                            </p>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="relative">
                  <div className="absolute right-3 top-3 z-10">
                    <button
                      onClick={() => {
                        navigator.clipboard.writeText(JSON.stringify(selectedFbSubmission.data, null, 2));
                        setToast({ type: "success", message: "JSON copied to clipboard" });
                      }}
                      className="px-2.5 py-1 text-xs font-medium rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-200 border border-zinc-700 cursor-pointer shadow-xs transition"
                    >
                      Copy JSON
                    </button>
                  </div>
                  <pre className="text-xs font-mono bg-zinc-950 text-zinc-200 p-4 rounded-xl overflow-x-auto border border-zinc-800 leading-relaxed">
                    {JSON.stringify(selectedFbSubmission.data, null, 2)}
                  </pre>
                </div>
              )}

              {/* Submission Metadata */}
              <div className="pt-4 border-t border-zinc-200 dark:border-zinc-800 grid grid-cols-2 gap-3 text-xs">
                <div>
                  <span className="text-zinc-400 block text-[11px]">Created At</span>
                  <span className="text-zinc-800 dark:text-zinc-200 font-medium">
                    {new Date(selectedFbSubmission.createdAt).toLocaleString()}
                  </span>
                </div>
                <div>
                  <span className="text-zinc-400 block text-[11px]">Domain Status</span>
                  <span className="text-zinc-800 dark:text-zinc-200 font-medium">
                    {selectedFbSubmission.emailVerified === true
                      ? "✓ Verified Valid"
                      : selectedFbSubmission.emailVerified === false
                      ? "✕ Invalid Domain"
                      : "Unverified"}
                  </span>
                </div>
                {selectedFbSubmission.ipAddress && (
                  <div>
                    <span className="text-zinc-400 block text-[11px]">IP Address</span>
                    <span className="text-zinc-800 dark:text-zinc-200 font-mono">
                      {selectedFbSubmission.ipAddress}
                    </span>
                  </div>
                )}
                {selectedFbSubmission.userAgent && (
                  <div className="col-span-2">
                    <span className="text-zinc-400 block text-[11px]">User Agent</span>
                    <span className="text-zinc-600 dark:text-zinc-400 text-[11px] truncate block" title={selectedFbSubmission.userAgent}>
                      {selectedFbSubmission.userAgent}
                    </span>
                  </div>
                )}
              </div>
            </div>

            {/* Modal Footer */}
            <div className="flex items-center justify-between px-6 py-4 border-t border-zinc-200 dark:border-zinc-800 bg-slate-50 dark:bg-[#111114] shrink-0">
              {canWrite ? (
                <button
                  onClick={() => handleDeleteFbSubmission(selectedFbSubmission.id)}
                  disabled={Boolean(deletingFbId)}
                  className="px-3 py-1.5 text-xs font-semibold text-red-600 hover:bg-red-50 dark:hover:bg-red-950/40 rounded-lg transition cursor-pointer"
                >
                  {deletingFbId === selectedFbSubmission.id ? "Deleting..." : "Delete Submission"}
                </button>
              ) : (
                <div />
              )}
              <button
                onClick={() => setSelectedFbSubmission(null)}
                className="px-4 py-2 text-xs font-semibold text-zinc-700 dark:text-zinc-300 bg-white dark:bg-zinc-800 hover:bg-slate-100 dark:hover:bg-zinc-700 border border-zinc-200 dark:border-zinc-700 rounded-xl cursor-pointer"
              >
                Close
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}
    </div>
  );
}
