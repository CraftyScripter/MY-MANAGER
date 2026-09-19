"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import DropdownSelect from "@/components/DropdownSelect";
import { hasWritePermission } from "@/lib/permissions";

interface CredentialLink {
  id: string;
  title: string;
  url: string;
}

interface Credential {
  id: string;
  accountName: string;
  category: string;
  username: string;
  accountUrl: string | null;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
  links: CredentialLink[];
}

interface Pagination {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

const CATEGORIES = [
  "Social Media",
  "Email",
  "Website",
  "Hosting",
  "Domain",
  "Payment",
  "Google Services",
  "Business Tools",
  "Other",
];

function CopyButton({ text, label }: { text: string; label?: string }) {
  const [copied, setCopied] = useState(false);

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      const textarea = document.createElement("textarea");
      textarea.value = text;
      textarea.style.position = "fixed";
      textarea.style.opacity = "0";
      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand("copy");
      document.body.removeChild(textarea);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  }

  return (
    <button
      onClick={handleCopy}
      className="text-zinc-400 hover:text-white text-xs bg-zinc-800 hover:bg-zinc-700 px-2 py-1 rounded-lg transition cursor-pointer inline-flex items-center gap-1"
      title={label || "Copy"}
    >
      {copied ? (
        <svg className="w-3 h-3 text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
        </svg>
      ) : (
        <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M15.666 3.888A2.25 2.25 0 0013.5 2.25h-3c-1.03 0-1.9.693-2.166 1.638m7.332 0c.055.194.084.4.084.612v0a.75.75 0 01-.75.75H9.75a.75.75 0 01-.75-.75v0c0-.212.03-.418.084-.612m7.332 0c.646.049 1.288.11 1.927.184 1.1.128 1.907 1.077 1.907 2.185V19.5a2.25 2.25 0 01-2.25 2.25H6.75A2.25 2.25 0 014.5 19.5V6.257c0-1.108.806-2.057 1.907-2.185a48.208 48.208 0 011.927-.184" />
        </svg>
      )}
      {label && <span>{copied ? "Copied" : label}</span>}
    </button>
  );
}

export default function CredentialsPage() {
  const [credentials, setCredentials] = useState<Credential[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [category, setCategory] = useState("all");
  const [sortField, setSortField] = useState("updatedAt");
  const [sortOrder, setSortOrder] = useState("desc");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState<number>(10);
  const [pagination, setPagination] = useState<Pagination>({ page: 1, limit: 10, total: 0, totalPages: 0 });
  const [refreshKey, setRefreshKey] = useState(0);
  const [toast, setToast] = useState<{ type: "success" | "error"; message: string } | null>(null);
  const [canWrite, setCanWrite] = useState(true);
  const initialLoadDone = useRef(false);

  const scrollToTop = () => {
    const fn = (window as unknown as { __scrollToTop?: () => void }).__scrollToTop;
    if (fn) {
      fn();
    } else {
      document.querySelector(".admin-scroll")?.scrollTo({ top: 0, behavior: "smooth" });
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
              setCanWrite(hasWritePermission(data.user.permissions, "credentials"));
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

  const [showAddModal, setShowAddModal] = useState(false);
  const [editingCredential, setEditingCredential] = useState<Credential | null>(null);
  const [detailCredential, setDetailCredential] = useState<Credential | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Credential | null>(null);
  const [deleting, setDeleting] = useState(false);

  const [formData, setFormData] = useState({
    accountName: "",
    category: "Social Media",
    username: "",
    password: "",
    accountUrl: "",
    notes: "",
    links: [] as { title: string; url: string }[],
  });
  const [formLoading, setFormLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  const [detailPassword, setDetailPassword] = useState<string | null>(null);
  const [detailPasswordVisible, setDetailPasswordVisible] = useState(false);
  const [detailLoading, setDetailLoading] = useState(false);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 4000);
    return () => clearTimeout(t);
  }, [toast]);

  useEffect(() => {
    const t = setTimeout(() => { setDebouncedSearch(search); setPage(1); }, 300);
    return () => clearTimeout(t);
  }, [search]);

  const fetchCredentials = useCallback(() => {
    let cancelled = false;
    if (initialLoadDone.current) setLoading(true);
    const params = new URLSearchParams();
    if (debouncedSearch) params.set("search", debouncedSearch);
    if (category !== "all") params.set("category", category);
    params.set("sort", sortField);
    params.set("order", sortOrder);
    params.set("page", String(page));
    params.set("limit", String(pageSize));
    fetch(`/api/admin/credentials?${params}`).then((r) => r.json())
      .then((data) => { if (!cancelled) { setCredentials(data.credentials || []); setPagination(data.pagination); } })
      .catch(() => { if (!cancelled) setToast({ type: "error", message: "Failed to load credentials" }); })
      .finally(() => { if (!cancelled) { setLoading(false); initialLoadDone.current = true; } });
    return () => { cancelled = true; };
  }, [debouncedSearch, category, sortField, sortOrder, page, pageSize, refreshKey]);

  useEffect(() => { return fetchCredentials(); }, [fetchCredentials]);

  function resetForm() {
    setFormData({ accountName: "", category: "Social Media", username: "", password: "", accountUrl: "", notes: "", links: [] });
    setShowPassword(false);
  }

  function openAddModal() {
    resetForm();
    setEditingCredential(null);
    setShowAddModal(true);
  }

  async function openEditModal(cred: Credential) {
    setEditingCredential(cred);
    setFormLoading(true);
    try {
      const res = await fetch(`/api/admin/credentials/${cred.id}`);
      const data = await res.json();
      if (data.credential) {
        setFormData({
          accountName: data.credential.accountName,
          category: data.credential.category,
          username: data.credential.username,
          password: "",
          accountUrl: data.credential.accountUrl || "",
          notes: data.credential.notes || "",
          links: data.credential.links?.map((l: CredentialLink) => ({ title: l.title, url: l.url })) || [],
        });
      }
    } catch {
      setToast({ type: "error", message: "Failed to load credential" });
    } finally {
      setFormLoading(false);
    }
    setShowPassword(false);
    setShowAddModal(true);
  }

  async function openDetailModal(cred: Credential) {
    setDetailCredential(null);
    setDetailPassword(null);
    setDetailPasswordVisible(false);
    try {
      const res = await fetch(`/api/admin/credentials/${cred.id}`);
      const data = await res.json();
      if (data.credential) setDetailCredential(data.credential);
    } catch {
      setToast({ type: "error", message: "Failed to load credential" });
    }
  }

  async function handleSave() {
    if (!formData.accountName.trim() || !formData.username.trim()) {
      setToast({ type: "error", message: "Account name and username are required" });
      return;
    }
    if (!editingCredential && !formData.password.trim()) {
      setToast({ type: "error", message: "Password is required" });
      return;
    }
    setFormLoading(true);
    try {
      const payload: Record<string, unknown> = {
        accountName: formData.accountName,
        category: formData.category,
        username: formData.username,
        accountUrl: formData.accountUrl || null,
        notes: formData.notes || null,
        links: formData.links,
      };
      if (formData.password.trim()) {
        payload.password = formData.password;
      }
      const url = editingCredential ? `/api/admin/credentials/${editingCredential.id}` : "/api/admin/credentials";
      const method = editingCredential ? "PUT" : "POST";
      const res = await fetch(url, { method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed");
      }
      setToast({ type: "success", message: editingCredential ? "Credential updated" : "Credential created" });
      setShowAddModal(false);
      setEditingCredential(null);
      resetForm();
      setRefreshKey((k) => k + 1);
    } catch (err) {
      setToast({ type: "error", message: err instanceof Error ? err.message : "Failed to save credential" });
    } finally {
      setFormLoading(false);
    }
  }

  async function handleDelete() {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      const res = await fetch(`/api/admin/credentials/${deleteTarget.id}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Failed");
      setToast({ type: "success", message: "Credential deleted" });
      setDeleteTarget(null);
      setRefreshKey((k) => k + 1);
    } catch {
      setToast({ type: "error", message: "Failed to delete credential" });
    } finally {
      setDeleting(false);
    }
  }

  async function handleRevealPassword(credId: string) {
    setDetailLoading(true);
    try {
      const res = await fetch(`/api/admin/credentials/${credId}/reveal`, { method: "POST" });
      const data = await res.json();
      if (data.password) {
        setDetailPassword(data.password);
        setDetailPasswordVisible(true);
      }
    } catch {
      setToast({ type: "error", message: "Failed to reveal password" });
    } finally {
      setDetailLoading(false);
    }
  }

  async function handleCopyPassword(credId: string) {
    try {
      const res = await fetch(`/api/admin/credentials/${credId}/copy`, { method: "POST" });
      const data = await res.json();
      if (data.password) {
        await navigator.clipboard.writeText(data.password);
        setToast({ type: "success", message: "Password copied to clipboard" });
      }
    } catch {
      setToast({ type: "error", message: "Failed to copy password" });
    }
  }

  function addLink() {
    setFormData((prev) => ({ ...prev, links: [...prev.links, { title: "", url: "" }] }));
  }

  function removeLink(index: number) {
    setFormData((prev) => ({ ...prev, links: prev.links.filter((_, i) => i !== index) }));
  }

  function updateLink(index: number, field: "title" | "url", value: string) {
    setFormData((prev) => {
      const links = [...prev.links];
      links[index] = { ...links[index], [field]: value };
      return { ...prev, links };
    });
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


      {/* 1. Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-zinc-900 dark:text-white flex items-center gap-2.5">
            <span className="p-2 rounded-xl bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/20">
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 10.5V6.75a4.5 4.5 0 10-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 002.25-2.25v-6.75a2.25 2.25 0 00-2.25-2.25H6.75a2.25 2.25 0 00-2.25 2.25v6.75a2.25 2.25 0 002.25 2.25z" />
              </svg>
            </span>
            Password Manager
          </h1>
          <p className="text-sm text-zinc-500 dark:text-zinc-400 mt-1">
            Securely manage encrypted logins, API keys, service credentials, and project secrets.
          </p>
        </div>
        <div className="flex items-center gap-2.5 shrink-0">
          <button
            onClick={() => setRefreshKey((k) => k + 1)}
            disabled={loading}
            className="flex items-center gap-2 px-3.5 py-2 text-xs font-semibold text-zinc-700 dark:text-zinc-200 bg-white dark:bg-[#111114] hover:bg-zinc-100 dark:hover:bg-zinc-800 border border-zinc-200 dark:border-zinc-800 hover:border-zinc-300 dark:hover:border-zinc-700 rounded-xl transition-all duration-150 cursor-pointer shadow-xs active:scale-97 disabled:opacity-60"
            title="Refresh Logins"
          >
            <svg className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0l3.181 3.183a8.25 8.25 0 0013.803-3.7M4.031 9.865a8.25 8.25 0 0113.803-3.7l3.181 3.182" />
            </svg>
            <span>Refresh</span>
          </button>
          {canWrite && (
            <button
              onClick={openAddModal}
              className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-xs font-bold transition-all duration-150 shadow-xs cursor-pointer active:scale-97 shrink-0"
            >
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
              </svg>
              <span>Add Credential</span>
            </button>
          )}
        </div>
      </div>

      {/* 2. Top Summary KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="p-5 bg-white dark:bg-[#111114] border border-zinc-200 dark:border-zinc-800 rounded-2xl shadow-xs hover:border-zinc-300 dark:hover:border-zinc-700 transition-all flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider">Total Logins</span>
            <span className="w-8 h-8 rounded-lg bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/20 flex items-center justify-center">
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 10.5V6.75a4.5 4.5 0 10-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 002.25-2.25v-6.75a2.25 2.25 0 00-2.25-2.25H6.75a2.25 2.25 0 00-2.25 2.25v6.75a2.25 2.25 0 002.25 2.25z" />
              </svg>
            </span>
          </div>
          <div className="mt-3">
            <p className="text-2xl font-bold tracking-tight text-zinc-900 dark:text-white">{pagination.total}</p>
            <p className="text-xs text-emerald-600 dark:text-emerald-400 font-medium mt-1">AES-256 encrypted</p>
          </div>
        </div>

        <div className="p-5 bg-white dark:bg-[#111114] border border-zinc-200 dark:border-zinc-800 rounded-2xl shadow-xs hover:border-zinc-300 dark:hover:border-zinc-700 transition-all flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider">Categories</span>
            <span className="w-8 h-8 rounded-lg bg-purple-500/10 text-purple-600 dark:text-purple-400 border border-purple-500/20 flex items-center justify-center">
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6A2.25 2.25 0 016 3.75h2.25A2.25 2.25 0 0110.5 6v2.25a2.25 2.25 0 01-2.25 2.25H6a2.25 2.25 0 01-2.25-2.25V6zM3.75 15.75A2.25 2.25 0 016 13.5h2.25a2.25 2.25 0 012.25 2.25V18a2.25 2.25 0 01-2.25 2.25H6A2.25 2.25 0 013.75 18v-2.25z" />
              </svg>
            </span>
          </div>
          <div className="mt-3">
            <p className="text-2xl font-bold tracking-tight text-zinc-900 dark:text-white">{CATEGORIES.length}</p>
            <p className="text-xs text-zinc-400 mt-1">Organized channels</p>
          </div>
        </div>

        <div className="p-5 bg-white dark:bg-[#111114] border border-zinc-200 dark:border-zinc-800 rounded-2xl shadow-xs hover:border-zinc-300 dark:hover:border-zinc-700 transition-all flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider">Social & Email</span>
            <span className="w-8 h-8 rounded-lg bg-pink-500/10 text-pink-600 dark:text-pink-400 border border-pink-500/20 flex items-center justify-center">
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M21.75 6.75v10.5a2.25 2.25 0 01-2.25 2.25h-15a2.25 2.25 0 01-2.25-2.25V6.75m19.5 0A2.25 2.25 0 0019.5 4.5h-15a2.25 2.25 0 00-2.25 2.25m19.5 0v.243a2.25 2.25 0 01-1.07 1.916l-7.5 4.615a2.25 2.25 0 01-2.36 0L3.32 8.91a2.25 2.25 0 01-1.07-1.916V6.75" />
              </svg>
            </span>
          </div>
          <div className="mt-3">
            <p className="text-2xl font-bold tracking-tight text-zinc-900 dark:text-white">
              {credentials.filter((c) => c.category === "Social Media" || c.category === "Email").length}
            </p>
            <p className="text-xs text-zinc-400 mt-1">Direct communication</p>
          </div>
        </div>

        <div className="p-5 bg-white dark:bg-[#111114] border border-zinc-200 dark:border-zinc-800 rounded-2xl shadow-xs hover:border-zinc-300 dark:hover:border-zinc-700 transition-all flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider">Hosting & Domains</span>
            <span className="w-8 h-8 rounded-lg bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20 flex items-center justify-center">
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 21a9.004 9.004 0 008.716-6.747M12 21a9.004 9.004 0 01-8.716-6.747M12 21c2.485 0 4.5-4.03 4.5-9S14.485 3 12 3m0 18c-2.485 0-4.5-4.03-4.5-9S9.515 3 12 3m0 0a8.997 8.997 0 017.843 4.582M12 3a8.997 8.997 0 00-7.843 4.582m15.686 0A11.953 11.953 0 0112 10.5c-2.998 0-5.74-1.1-7.843-2.918m15.686 0A8.959 8.959 0 0121 12c0 .778-.099 1.533-.284 2.253m0 0A17.919 17.919 0 0112 16.5c-3.162 0-6.133-.815-8.716-2.247m0 0A9.015 9.015 0 013 12c0-1.605.42-3.113 1.157-4.418" />
              </svg>
            </span>
          </div>
          <div className="mt-3">
            <p className="text-2xl font-bold tracking-tight text-zinc-900 dark:text-white">
              {credentials.filter((c) => c.category === "Hosting" || c.category === "Domain" || c.category === "Website").length}
            </p>
            <p className="text-xs text-zinc-400 mt-1">Infrastructure keys</p>
          </div>
        </div>
      </div>

      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <svg className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-400 dark:text-zinc-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z" /></svg>
          <input type="text" placeholder="Search by name or username..." value={search} onChange={(e) => setSearch(e.target.value)} className="w-full bg-white dark:bg-[#111114] border border-zinc-200 dark:border-zinc-800 rounded-xl pl-10 pr-4 py-2.5 text-xs text-zinc-900 dark:text-zinc-200 placeholder:text-zinc-400 dark:placeholder:text-zinc-500 focus:outline-none focus:border-zinc-400 dark:focus:border-zinc-600 transition shadow-xs" />
        </div>
        <DropdownSelect value={category} onChange={(v) => { setCategory(v); setPage(1); }} options={[{ label: "All Categories", value: "all" }, ...CATEGORIES.map((c) => ({ label: c, value: c }))]} className="w-48" />
        <DropdownSelect value={`${sortField}-${sortOrder}`} onChange={(v) => { const [f, o] = v.split("-"); setSortField(f); setSortOrder(o); }} options={[{ label: "Newest Updated", value: "updatedAt-desc" }, { label: "Oldest Updated", value: "updatedAt-asc" }, { label: "Name A-Z", value: "accountName-asc" }, { label: "Name Z-A", value: "accountName-desc" }, { label: "Category A-Z", value: "category-asc" }]} className="w-48" />
      </div>

      <div className="bg-white dark:bg-[#111114] border border-zinc-200 dark:border-zinc-800 rounded-2xl overflow-hidden shadow-xs">
        {loading ? (
          <div className="flex items-center justify-center py-20"><div className="w-6 h-6 border-2 border-zinc-400 dark:border-zinc-600 border-t-blue-600 dark:border-t-zinc-300 rounded-full animate-spin" /></div>
        ) : credentials.length === 0 ? (
          <div className="text-center py-20"><p className="text-zinc-500 dark:text-zinc-600">No credentials found</p></div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead><tr className="border-b border-zinc-200 dark:border-zinc-800 bg-slate-50 dark:bg-transparent">
                  <th className="text-left px-6 py-4 font-medium text-zinc-600 dark:text-zinc-500">Platform</th>
                  <th className="text-left px-6 py-4 font-medium text-zinc-600 dark:text-zinc-500">Username</th>
                  <th className="text-left px-6 py-4 font-medium text-zinc-600 dark:text-zinc-500">Category</th>
                  <th className="text-left px-6 py-4 font-medium text-zinc-600 dark:text-zinc-500">Links</th>
                  <th className="text-left px-6 py-4 font-medium text-zinc-600 dark:text-zinc-500">Password</th>
                  <th className="text-left px-6 py-4 font-medium text-zinc-600 dark:text-zinc-500">Updated</th>
                  <th className="text-right px-6 py-4 font-medium text-zinc-600 dark:text-zinc-500">Actions</th>
                </tr></thead>
                <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800/50">
                  {credentials.map((cred) => (
                    <tr key={cred.id} className="hover:bg-slate-50/80 dark:hover:bg-zinc-800/20 transition-colors">
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-full bg-slate-100 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 flex items-center justify-center text-xs font-medium text-zinc-700 dark:text-zinc-400 shrink-0">{cred.accountName.charAt(0).toUpperCase()}</div>
                          <div>
                            <span className="font-medium text-zinc-900 dark:text-white">{cred.accountName}</span>
                            {cred.accountUrl && <a href={cred.accountUrl} target="_blank" rel="noopener noreferrer" className="block text-xs text-blue-600 dark:text-zinc-500 hover:underline truncate max-w-[160px]">{cred.accountUrl}</a>}
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4 text-zinc-700 dark:text-zinc-400">{cred.username}</td>
                      <td className="px-6 py-4"><span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-slate-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 border border-zinc-200 dark:border-zinc-700">{cred.category}</span></td>
                      <td className="px-6 py-4 text-zinc-500">{cred.links.length > 0 ? `${cred.links.length} link${cred.links.length !== 1 ? "s" : ""}` : "—"}</td>
                      <td className="px-6 py-4 font-mono text-zinc-400 dark:text-zinc-500">••••••••••••</td>
                      <td className="px-6 py-4 text-zinc-500 whitespace-nowrap">{new Date(cred.updatedAt).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}</td>
                      <td className="px-6 py-4">
                        <div className="flex items-center justify-end gap-2">
                          <button onClick={() => openDetailModal(cred)} className="text-zinc-700 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white text-xs bg-slate-100 dark:bg-zinc-800 hover:bg-slate-200 dark:hover:bg-zinc-700 border border-zinc-200 dark:border-zinc-700/60 px-3 py-1.5 rounded-lg transition cursor-pointer">View</button>
                          {canWrite && <button onClick={() => openEditModal(cred)} className="text-zinc-700 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white text-xs bg-slate-100 dark:bg-zinc-800 hover:bg-slate-200 dark:hover:bg-zinc-700 border border-zinc-200 dark:border-zinc-700/60 px-3 py-1.5 rounded-lg transition cursor-pointer">Edit</button>}
                          {canWrite && <button onClick={() => setDeleteTarget(cred)} className="text-zinc-400 hover:text-red-600 dark:hover:text-red-400 text-xs bg-slate-100 dark:bg-zinc-800 hover:bg-red-50 dark:hover:bg-red-950/50 border border-zinc-200 dark:border-zinc-700/60 px-3 py-1.5 rounded-lg transition cursor-pointer">Delete</button>}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {/* Solid Color Compact Pagination Bar */}
            {pagination.total > 0 && (
              <div className="flex flex-col sm:flex-row items-center justify-between gap-4 px-6 py-3.5 border-t border-zinc-200 dark:border-[#27272a] bg-slate-50 dark:bg-[#111114]">
                {/* Left: Range Info */}
                <div className="text-xs text-zinc-600 dark:text-zinc-400 font-medium">
                  Showing <strong className="text-zinc-900 dark:text-white">{((pagination.page - 1) * pagination.limit) + 1}</strong>–<strong className="text-zinc-900 dark:text-white">{Math.min(pagination.page * pagination.limit, pagination.total)}</strong> of <strong className="text-zinc-900 dark:text-white">{pagination.total}</strong> accounts
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
                  <button
                    onClick={() => { setPage(1); scrollToTop(); }}
                    disabled={page === 1}
                    className="px-2 py-1.5 text-xs font-medium text-zinc-700 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white bg-white dark:bg-[#18181b] hover:bg-zinc-100 dark:hover:bg-[#222226] border border-zinc-200 dark:border-[#27272a] disabled:opacity-30 disabled:cursor-not-allowed rounded-lg cursor-pointer"
                    title="First Page"
                  >
                    «
                  </button>
                  <button
                    onClick={() => { setPage(Math.max(1, page - 1)); scrollToTop(); }}
                    disabled={page === 1}
                    className="px-3 py-1.5 text-xs font-medium text-zinc-700 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white bg-white dark:bg-[#18181b] hover:bg-zinc-100 dark:hover:bg-[#222226] border border-zinc-200 dark:border-[#27272a] disabled:opacity-30 disabled:cursor-not-allowed rounded-lg cursor-pointer flex items-center gap-1"
                  >
                    <span>‹</span> Prev
                  </button>

                  <div className="flex items-center gap-1">
                    {Array.from({ length: pagination.totalPages }, (_, i) => i + 1)
                      .filter((p) => p === 1 || p === pagination.totalPages || Math.abs(p - page) <= 1)
                      .reduce<(number | "ellipsis")[]>((acc, p, i, arr) => {
                        if (i > 0 && p - (arr[i - 1] as number) > 1) acc.push("ellipsis");
                        acc.push(p);
                        return acc;
                      }, [])
                      .map((item, i) =>
                        item === "ellipsis" ? (
                          <span key={`e${i}`} className="px-1 text-xs text-zinc-400">
                            ...
                          </span>
                        ) : (
                          <button
                            key={item}
                            onClick={() => { setPage(item); scrollToTop(); }}
                            className={`w-7 h-7 text-xs font-semibold rounded-lg cursor-pointer transition-colors ${
                              page === item
                                ? "bg-blue-600 text-white font-bold shadow-xs border border-blue-600"
                                : "text-zinc-700 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white bg-white dark:bg-zinc-900 hover:bg-zinc-100 dark:hover:bg-zinc-800 border border-zinc-200 dark:border-zinc-800"
                            }`}
                          >
                            {item}
                          </button>
                        )
                      )}
                  </div>

                  <button
                    onClick={() => { setPage(Math.min(pagination.totalPages, page + 1)); scrollToTop(); }}
                    disabled={page === pagination.totalPages || pagination.totalPages === 0}
                    className="px-3 py-1.5 text-xs font-medium text-zinc-700 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white bg-white dark:bg-[#18181b] hover:bg-zinc-100 dark:hover:bg-[#222226] border border-zinc-200 dark:border-[#27272a] disabled:opacity-30 disabled:cursor-not-allowed rounded-lg cursor-pointer flex items-center gap-1"
                  >
                    Next <span>›</span>
                  </button>
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

      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 animate-in fade-in duration-150">
          <div className="bg-white dark:bg-[#111114] border border-zinc-200 dark:border-zinc-800 rounded-2xl w-full max-w-lg shadow-2xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between px-6 py-4 border-b border-zinc-200 dark:border-zinc-800 bg-slate-50 dark:bg-zinc-900/50">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-blue-50 dark:bg-blue-600/10 border border-blue-200 dark:border-blue-500/20 text-blue-600 dark:text-blue-400 flex items-center justify-center">
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 10.5V6.75a4.5 4.5 0 10-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 002.25-2.25v-6.75a2.25 2.25 0 00-2.25-2.25H6.75a2.25 2.25 0 00-2.25 2.25v6.75a2.25 2.25 0 002.25 2.25z" />
                  </svg>
                </div>
                <h2 className="text-base font-bold text-zinc-900 dark:text-white">{editingCredential ? "Edit Credential" : "Add Credential"}</h2>
              </div>
              <button onClick={() => { setShowAddModal(false); setEditingCredential(null); resetForm(); }} className="text-zinc-400 hover:text-zinc-700 dark:hover:text-white p-1.5 rounded-xl hover:bg-slate-200/60 dark:hover:bg-zinc-800 transition cursor-pointer">
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
              </button>
            </div>
            <div className="px-6 py-5 space-y-4">
              <div>
                <label className="text-xs font-medium text-zinc-500 dark:text-zinc-400 block mb-1.5">Account / Platform Name *</label>
                <input type="text" value={formData.accountName} onChange={(e) => setFormData((p) => ({ ...p, accountName: e.target.value }))} placeholder="e.g. Instagram" className="w-full bg-white dark:bg-[#111114] border border-zinc-300 dark:border-zinc-800 rounded-xl px-4 py-2.5 text-sm text-zinc-900 dark:text-zinc-200 placeholder:text-zinc-400 dark:placeholder:text-zinc-600 focus:outline-none focus:border-zinc-400 dark:focus:border-zinc-600 transition" />
              </div>
              <div>
                <label className="text-xs font-medium text-zinc-500 dark:text-zinc-400 block mb-1.5">Category *</label>
                <DropdownSelect value={formData.category} onChange={(v) => setFormData((p) => ({ ...p, category: v }))} options={CATEGORIES.map((c) => ({ label: c, value: c }))} className="w-full" />
              </div>
              <div>
                <label className="text-xs font-medium text-zinc-500 dark:text-zinc-400 block mb-1.5">Username / ID / Email *</label>
                <input type="text" value={formData.username} onChange={(e) => setFormData((p) => ({ ...p, username: e.target.value }))} placeholder="e.g. user@email.com" className="w-full bg-white dark:bg-[#111114] border border-zinc-300 dark:border-zinc-800 rounded-xl px-4 py-2.5 text-sm text-zinc-900 dark:text-zinc-200 placeholder:text-zinc-400 dark:placeholder:text-zinc-600 focus:outline-none focus:border-zinc-400 dark:focus:border-zinc-600 transition" />
              </div>
              <div>
                <label className="text-xs font-medium text-zinc-500 dark:text-zinc-400 block mb-1.5">Password {editingCredential ? "" : "*"}</label>
                <div className="relative">
                  <input type={showPassword ? "text" : "password"} value={formData.password} onChange={(e) => setFormData((p) => ({ ...p, password: e.target.value }))} placeholder={editingCredential ? "Leave empty to keep current" : "Enter password"} className="w-full bg-white dark:bg-[#111114] border border-zinc-300 dark:border-zinc-800 rounded-xl px-4 py-2.5 pr-24 text-sm text-zinc-900 dark:text-zinc-200 placeholder:text-zinc-400 dark:placeholder:text-zinc-600 focus:outline-none focus:border-zinc-400 dark:focus:border-zinc-600 transition" />
                  <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-1">
                    <button type="button" onClick={() => setShowPassword(!showPassword)} className="text-zinc-500 hover:text-zinc-900 dark:hover:text-white text-xs px-2 py-1 rounded-lg hover:bg-zinc-100 dark:hover:bg-zinc-800 transition cursor-pointer">{showPassword ? "Hide" : "Show"}</button>
                    {formData.password && <button type="button" onClick={() => { navigator.clipboard.writeText(formData.password); setToast({ type: "success", message: "Password copied" }); }} className="text-zinc-500 hover:text-zinc-900 dark:hover:text-white text-xs px-2 py-1 rounded-lg hover:bg-zinc-100 dark:hover:bg-zinc-800 transition cursor-pointer">Copy</button>}
                  </div>
                </div>
              </div>
              <div>
                <label className="text-xs font-medium text-zinc-500 dark:text-zinc-400 block mb-1.5">Account URL</label>
                <input type="url" value={formData.accountUrl} onChange={(e) => setFormData((p) => ({ ...p, accountUrl: e.target.value }))} placeholder="https://..." className="w-full bg-white dark:bg-[#111114] border border-zinc-300 dark:border-zinc-800 rounded-xl px-4 py-2.5 text-sm text-zinc-900 dark:text-zinc-200 placeholder:text-zinc-400 dark:placeholder:text-zinc-600 focus:outline-none focus:border-zinc-400 dark:focus:border-zinc-600 transition" />
              </div>
              <div>
                <label className="text-xs font-medium text-zinc-500 dark:text-zinc-400 block mb-1.5">Notes</label>
                <textarea value={formData.notes} onChange={(e) => setFormData((p) => ({ ...p, notes: e.target.value }))} rows={3} placeholder="Additional notes..." className="w-full bg-white dark:bg-[#111114] border border-zinc-300 dark:border-zinc-800 rounded-xl px-4 py-2.5 text-sm text-zinc-900 dark:text-zinc-200 placeholder:text-zinc-400 dark:placeholder:text-zinc-600 focus:outline-none focus:border-zinc-400 dark:focus:border-zinc-600 resize-none transition" />
              </div>
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="text-xs font-medium text-zinc-500 dark:text-zinc-400">Links</label>
                  <button type="button" onClick={addLink} className="text-zinc-500 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white text-xs bg-slate-100 dark:bg-zinc-800 hover:bg-slate-200 dark:hover:bg-zinc-700 border border-zinc-200 dark:border-zinc-700 px-3 py-1.5 rounded-lg transition cursor-pointer flex items-center gap-1">
                    <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" /></svg>
                    Add Link
                  </button>
                </div>
                <div className="space-y-2">
                  {formData.links.map((link, i) => (
                    <div key={i} className="flex gap-2">
                      <input type="text" value={link.title} onChange={(e) => updateLink(i, "title", e.target.value)} placeholder="Title" className="w-1/3 bg-white dark:bg-[#111114] border border-zinc-300 dark:border-zinc-800 rounded-xl px-3 py-2 text-sm text-zinc-900 dark:text-zinc-200 placeholder:text-zinc-400 dark:placeholder:text-zinc-600 focus:outline-none focus:border-zinc-400 dark:focus:border-zinc-600 transition" />
                      <input type="url" value={link.url} onChange={(e) => updateLink(i, "url", e.target.value)} placeholder="https://..." className="flex-1 bg-white dark:bg-[#111114] border border-zinc-300 dark:border-zinc-800 rounded-xl px-3 py-2 text-sm text-zinc-900 dark:text-zinc-200 placeholder:text-zinc-400 dark:placeholder:text-zinc-600 focus:outline-none focus:border-zinc-400 dark:focus:border-zinc-600 transition" />
                      <button type="button" onClick={() => removeLink(i)} className="text-zinc-400 hover:text-red-500 px-2 transition cursor-pointer text-lg leading-none">×</button>
                    </div>
                  ))}
                </div>
              </div>
            </div>
            <div className="flex justify-end gap-3 px-6 py-4 border-t border-zinc-200 dark:border-zinc-800 bg-slate-50 dark:bg-zinc-900/30">
              <button onClick={() => { setShowAddModal(false); setEditingCredential(null); resetForm(); }} className="px-4 py-2 text-xs font-semibold text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white bg-slate-100 dark:bg-zinc-800 hover:bg-slate-200 dark:hover:bg-zinc-700 border border-zinc-200 dark:border-zinc-700 rounded-xl transition cursor-pointer">Cancel</button>
              <button onClick={handleSave} disabled={formLoading} className="btn-primary px-5 py-2 text-xs font-bold disabled:opacity-40 disabled:cursor-not-allowed rounded-xl">{formLoading ? "Saving..." : editingCredential ? "Update" : "Create"}</button>
            </div>
          </div>
        </div>
      )}

      {detailCredential && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 animate-in fade-in duration-150">
          <div className="bg-white dark:bg-[#111114] border border-zinc-200 dark:border-zinc-800 rounded-2xl w-full max-w-lg shadow-2xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between px-6 py-4 border-b border-zinc-200 dark:border-zinc-800 bg-slate-50 dark:bg-zinc-900/50">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-violet-50 dark:bg-violet-600/10 border border-violet-200 dark:border-violet-500/20 text-violet-600 dark:text-violet-400 flex items-center justify-center">
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 10.5V6.75a4.5 4.5 0 10-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 002.25-2.25v-6.75a2.25 2.25 0 00-2.25-2.25H6.75a2.25 2.25 0 00-2.25 2.25v6.75a2.25 2.25 0 002.25 2.25z" />
                  </svg>
                </div>
                <h2 className="text-base font-bold text-zinc-900 dark:text-white">Credential Details</h2>
              </div>
              <button onClick={() => { setDetailCredential(null); setDetailPassword(null); setDetailPasswordVisible(false); }} className="text-zinc-400 hover:text-zinc-700 dark:hover:text-white p-1.5 rounded-xl hover:bg-slate-200/60 dark:hover:bg-zinc-800 transition cursor-pointer">
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
              </button>
            </div>
            <div className="px-6 py-5 space-y-5">
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-xs font-medium text-zinc-500 dark:text-zinc-400">Platform</span>
                    <CopyButton text={detailCredential.accountName} />
                  </div>
                  <span className="font-semibold text-zinc-900 dark:text-white">{detailCredential.accountName}</span>
                </div>
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-xs font-medium text-zinc-500 dark:text-zinc-400">Category</span>
                    <CopyButton text={detailCredential.category} />
                  </div>
                  <span className="font-semibold text-zinc-900 dark:text-white">{detailCredential.category}</span>
                </div>
              </div>

              <div className="text-sm">
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-xs font-medium text-zinc-500 dark:text-zinc-400">Username / Email</span>
                  <CopyButton text={detailCredential.username} />
                </div>
                <span className="font-semibold text-zinc-900 dark:text-white">{detailCredential.username}</span>
              </div>

              <div className="text-sm">
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-xs font-medium text-zinc-500 dark:text-zinc-400">Password</span>
                </div>
                <div className="flex items-center gap-3">
                  <span className="font-mono text-zinc-900 dark:text-zinc-300 bg-slate-100 dark:bg-zinc-800/50 border border-zinc-200 dark:border-zinc-800 rounded-xl px-4 py-2.5 flex-1 text-sm">
                    {detailPasswordVisible && detailPassword ? detailPassword : "••••••••••••••••"}
                  </span>
                  <button
                    onClick={() => {
                      if (detailPasswordVisible) {
                        setDetailPasswordVisible(false);
                        setDetailPassword(null);
                      } else {
                        handleRevealPassword(detailCredential.id);
                      }
                    }}
                    disabled={detailLoading}
                    className="text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white text-xs bg-slate-100 dark:bg-zinc-800 hover:bg-slate-200 dark:hover:bg-zinc-700 border border-zinc-200 dark:border-zinc-700 px-3 py-2.5 rounded-xl transition cursor-pointer disabled:opacity-40 whitespace-nowrap"
                  >
                    {detailLoading ? "Loading..." : detailPasswordVisible ? "Hide" : "Show"}
                  </button>
                  <button
                    onClick={() => handleCopyPassword(detailCredential.id)}
                    className="text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white text-xs bg-slate-100 dark:bg-zinc-800 hover:bg-slate-200 dark:hover:bg-zinc-700 border border-zinc-200 dark:border-zinc-700 px-3 py-2.5 rounded-xl transition cursor-pointer whitespace-nowrap"
                  >
                    Copy
                  </button>
                </div>
              </div>

              {detailCredential.accountUrl && (
                <div className="text-sm">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-xs font-medium text-zinc-500 dark:text-zinc-400">Account URL</span>
                    <CopyButton text={detailCredential.accountUrl} />
                  </div>
                  <a href={detailCredential.accountUrl} target="_blank" rel="noopener noreferrer" className="font-medium text-blue-600 dark:text-blue-400 hover:underline break-all">{detailCredential.accountUrl}</a>
                </div>
              )}

              {detailCredential.links.length > 0 && (
                <div className="text-sm">
                  <span className="text-xs font-medium text-zinc-500 dark:text-zinc-400 block mb-2">Links</span>
                  <div className="space-y-2">
                    {detailCredential.links.map((link) => (
                      <div key={link.id} className="flex items-center gap-2 bg-slate-50 dark:bg-zinc-800/50 border border-zinc-200 dark:border-zinc-800 rounded-xl px-4 py-2.5">
                        <span className="text-zinc-500 dark:text-zinc-400 text-xs shrink-0">{link.title}</span>
                        <a href={link.url} target="_blank" rel="noopener noreferrer" className="text-blue-600 dark:text-blue-400 hover:underline text-xs truncate flex-1">{link.url}</a>
                        <CopyButton text={link.url} />
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {detailCredential.notes && (
                <div className="text-sm">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-xs font-medium text-zinc-500 dark:text-zinc-400">Notes</span>
                    <CopyButton text={detailCredential.notes} />
                  </div>
                  <div className="bg-slate-50 dark:bg-zinc-800/50 border border-zinc-200 dark:border-zinc-800 rounded-xl p-4 text-sm text-zinc-700 dark:text-zinc-300 whitespace-pre-wrap">{detailCredential.notes}</div>
                </div>
              )}

              <div className="grid grid-cols-2 gap-4 text-xs text-zinc-500 dark:text-zinc-500 pt-2 border-t border-zinc-200 dark:border-zinc-800">
                <div>Created: {new Date(detailCredential.createdAt).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}</div>
                <div>Updated: {new Date(detailCredential.updatedAt).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}</div>
              </div>
            </div>
            <div className="flex justify-end gap-3 px-6 py-4 border-t border-zinc-200 dark:border-zinc-800 bg-slate-50 dark:bg-zinc-900/30">
              <button onClick={() => { setDetailCredential(null); setDetailPassword(null); setDetailPasswordVisible(false); }} className="px-4 py-2 text-xs font-semibold text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white bg-slate-100 dark:bg-zinc-800 hover:bg-slate-200 dark:hover:bg-zinc-700 border border-zinc-200 dark:border-zinc-700 rounded-xl transition cursor-pointer">Close</button>
              {canWrite && (
                <button onClick={() => { const c = detailCredential; setDetailCredential(null); setDetailPassword(null); setDetailPasswordVisible(false); openEditModal(c); }} className="px-5 py-2 text-xs font-bold text-white bg-blue-600 hover:bg-blue-500 rounded-xl transition cursor-pointer">Edit</button>
              )}
            </div>
          </div>
        </div>
      )}

      {deleteTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 animate-in fade-in duration-150">
          <div className="bg-white dark:bg-[#111114] border border-zinc-200 dark:border-zinc-800 rounded-2xl w-full max-w-md shadow-2xl">
            <div className="flex items-start gap-4 p-6">
              <div className="w-10 h-10 rounded-xl bg-red-50 dark:bg-red-500/10 border border-red-200 dark:border-red-500/20 text-red-600 dark:text-red-400 flex items-center justify-center shrink-0">
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
                </svg>
              </div>
              <div className="space-y-1">
                <h3 className="text-base font-bold text-zinc-900 dark:text-white">Delete Credential</h3>
                <p className="text-xs text-zinc-500 dark:text-zinc-400 leading-relaxed">
                  Are you sure you want to delete <span className="font-semibold text-zinc-900 dark:text-white">{deleteTarget.accountName}</span>? This action cannot be undone.
                </p>
              </div>
            </div>
            <div className="flex justify-end gap-3 px-6 py-4 border-t border-zinc-200 dark:border-zinc-800 bg-slate-50 dark:bg-zinc-900/30">
              <button onClick={() => setDeleteTarget(null)} className="px-4 py-2 text-xs font-semibold text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white bg-slate-100 dark:bg-zinc-800 hover:bg-slate-200 dark:hover:bg-zinc-700 border border-zinc-200 dark:border-zinc-700 rounded-xl transition cursor-pointer">Cancel</button>
              <button onClick={handleDelete} disabled={deleting} className="px-5 py-2 text-xs font-bold text-white bg-red-600 hover:bg-red-500 disabled:opacity-40 disabled:cursor-not-allowed rounded-xl transition cursor-pointer flex items-center gap-2">
                {deleting && <span className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />}
                {deleting ? "Deleting..." : "Delete"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
