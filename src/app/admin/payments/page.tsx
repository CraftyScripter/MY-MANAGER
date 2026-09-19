"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import DropdownSelect from "@/components/DropdownSelect";
import { hasWritePermission } from "@/lib/permissions";

interface Payment {
  id: string;
  transactionId: string;
  date: string;
  type: string;
  amount: string;
  currency: string;
  status: string;
  paymentMethod: string | null;
  paidBy: string | null;
  paidTo: string | null;
  purposeCategory: string | null;
  description: string | null;
  referenceNumber: string | null;
  receiptUrl: string | null;
  receiptPublicId: string | null;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
}

interface Summary {
  totalIncome: number;
  totalExpenses: number;
  totalRefunds: number;
  totalTransfers: number;
  netBalance: number;
  pendingAmount: number;
}

interface Pagination {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

const TRANSACTION_TYPES = ["Income", "Expense", "Refund", "Transfer"];
const STATUSES = ["Pending", "Completed", "Failed", "Cancelled", "Refunded"];
const PAYMENT_METHODS = ["UPI", "Bank Transfer", "Card", "Cash", "Razorpay", "PayPal", "Other"];
const CURRENCIES = ["INR", "USD", "EUR", "GBP"];
const CURRENCY_SYMBOLS: Record<string, string> = { INR: "₹", USD: "$", EUR: "€", GBP: "£" };

function formatAmount(amount: string, currency: string) {
  const num = parseFloat(amount) || 0;
  const sym = CURRENCY_SYMBOLS[currency] || currency + " ";
  return `${sym}${num.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function CopyButton({ text, label }: { text: string; label?: string }) {
  const [copied, setCopied] = useState(false);
  async function handleCopy(e: React.MouseEvent) {
    e.stopPropagation();
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      const ta = document.createElement("textarea");
      ta.value = text;
      ta.style.position = "fixed";
      ta.style.opacity = "0";
      document.body.appendChild(ta);
      ta.select();
      document.execCommand("copy");
      document.body.removeChild(ta);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  }
  return (
    <button
      onClick={handleCopy}
      type="button"
      className="text-zinc-400 hover:text-zinc-700 dark:hover:text-white p-1 rounded-md hover:bg-slate-100 dark:hover:bg-zinc-800 transition cursor-pointer inline-flex items-center gap-1 shrink-0"
      title={label || "Copy to clipboard"}
    >
      {copied ? (
        <span className="inline-flex items-center gap-1 text-[11px] text-emerald-400 font-medium">
          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
          </svg>
          {label ? "Copied" : ""}
        </span>
      ) : (
        <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M15.666 3.888A2.25 2.25 0 0013.5 2.25h-3c-1.03 0-1.9.693-2.166 1.638m7.332 0c.055.194.084.4.084.612v0a.75.75 0 01-.75.75H9.75a.75.75 0 01-.75-.75v0c0-.212.03-.418.084-.612m7.332 0c.646.049 1.288.11 1.927.184 1.1.128 1.907 1.077 1.907 2.185V19.5a2.25 2.25 0 01-2.25 2.25H6.75A2.25 2.25 0 014.5 19.5V6.257c0-1.108.806-2.057 1.907-2.185a48.208 48.208 0 011.927-.184" />
        </svg>
      )}
    </button>
  );
}


const TYPE_COLORS: Record<string, string> = {
  Income: "bg-emerald-50 dark:bg-emerald-950/50 text-emerald-700 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800/50",
  Expense: "bg-red-50 dark:bg-red-950/50 text-red-700 dark:text-red-400 border border-red-200 dark:border-red-800/50",
  Refund: "bg-amber-50 dark:bg-amber-950/50 text-amber-700 dark:text-amber-400 border border-amber-200 dark:border-amber-800/50",
  Transfer: "bg-blue-50 dark:bg-blue-950/50 text-blue-700 dark:text-blue-400 border border-blue-200 dark:border-blue-800/50",
};

const STATUS_COLORS: Record<string, string> = {
  Completed: "bg-emerald-50 dark:bg-emerald-950/50 text-emerald-700 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800/50",
  Pending: "bg-amber-50 dark:bg-amber-950/50 text-amber-700 dark:text-amber-400 border border-amber-200 dark:border-amber-800/50",
  Failed: "bg-red-50 dark:bg-red-950/50 text-red-700 dark:text-red-400 border border-red-200 dark:border-red-800/50",
  Cancelled: "bg-slate-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 border border-zinc-200 dark:border-zinc-700",
  Refunded: "bg-blue-50 dark:bg-blue-950/50 text-blue-700 dark:text-blue-400 border border-blue-200 dark:border-blue-800/50",
};

const emptyForm = {
  date: new Date().toISOString().split("T")[0],
  type: "Income",
  amount: "",
  currency: "INR",
  status: "Pending",
  paymentMethod: "",
  paidBy: "",
  paidTo: "",
  purposeCategory: "",
  description: "",
  referenceNumber: "",
  receiptUrl: "",
  receiptPublicId: "",
  notes: "",
};

export default function PaymentsPage() {
  const [payments, setPayments] = useState<Payment[]>([]);
  const [loading, setLoading] = useState(true);
  const [summary, setSummary] = useState<Summary | null>(null);
  const [summaryLoading, setSummaryLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [methodFilter, setMethodFilter] = useState("all");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [sortField, setSortField] = useState("date");
  const [sortOrder, setSortOrder] = useState("desc");
  const [page, setPage] = useState(1);
  const [pagination, setPagination] = useState<Pagination>({ page: 1, limit: 20, total: 0, totalPages: 0 });
  const [refreshKey, setRefreshKey] = useState(0);
  const [toast, setToast] = useState<{ type: "success" | "error"; message: string } | null>(null);
  const [canWrite, setCanWrite] = useState(true);
  const initialLoadDone = useRef(false);

  useEffect(() => {
    const fetchUser = () => {
      fetch("/api/admin/auth/me")
        .then((r) => r.json())
        .then((data) => {
          if (data.user) {
            if (data.user.role === "admin") {
              setCanWrite(true);
            } else {
              setCanWrite(hasWritePermission(data.user.permissions, "finance"));
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
  const [editingPayment, setEditingPayment] = useState<Payment | null>(null);
  const [detailPayment, setDetailPayment] = useState<Payment | null>(null);
  const [formData, setFormData] = useState(emptyForm);
  const [formLoading, setFormLoading] = useState(false);
  const [uploading, setUploading] = useState(false);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 4000);
    return () => clearTimeout(t);
  }, [toast]);

  useEffect(() => {
    const t = setTimeout(() => { setDebouncedSearch(search); setPage(1); }, 300);
    return () => clearTimeout(t);
  }, [search]);

  const fetchSummary = useCallback(() => {
    setSummaryLoading(true);
    fetch("/api/admin/payments/summary")
      .then((r) => r.json())
      .then((data) => setSummary(data))
      .catch(() => {})
      .finally(() => setSummaryLoading(false));
  }, []);

  const fetchPayments = useCallback(() => {
    let cancelled = false;
    if (initialLoadDone.current) setLoading(true);
    const params = new URLSearchParams();
    if (debouncedSearch) params.set("search", debouncedSearch);
    if (typeFilter !== "all") params.set("type", typeFilter);
    if (statusFilter !== "all") params.set("status", statusFilter);
    if (methodFilter !== "all") params.set("paymentMethod", methodFilter);
    if (startDate) params.set("startDate", startDate);
    if (endDate) params.set("endDate", endDate);
    params.set("sort", sortField);
    params.set("order", sortOrder);
    params.set("page", String(page));
    params.set("limit", "20");
    fetch(`/api/admin/payments?${params}`)
      .then((r) => r.json())
      .then((data) => { if (!cancelled) { setPayments(data.payments || []); setPagination(data.pagination); } })
      .catch(() => { if (!cancelled) setToast({ type: "error", message: "Failed to load payments" }); })
      .finally(() => { if (!cancelled) { setLoading(false); initialLoadDone.current = true; } });
    return () => { cancelled = true; };
  }, [debouncedSearch, typeFilter, statusFilter, methodFilter, startDate, endDate, sortField, sortOrder, page, refreshKey]);

  useEffect(() => { fetchSummary(); }, [fetchSummary, refreshKey]);
  useEffect(() => { return fetchPayments(); }, [fetchPayments]);

  function resetForm() { setFormData(emptyForm); }

  function openAddModal() { resetForm(); setEditingPayment(null); setShowAddModal(true); }

  async function openEditModal(p: Payment) {
    setEditingPayment(p);
    setFormData({
      date: p.date.split("T")[0],
      type: p.type,
      amount: p.amount,
      currency: p.currency,
      status: p.status,
      paymentMethod: p.paymentMethod || "",
      paidBy: p.paidBy || "",
      paidTo: p.paidTo || "",
      purposeCategory: p.purposeCategory || "",
      description: p.description || "",
      referenceNumber: p.referenceNumber || "",
      receiptUrl: p.receiptUrl || "",
      receiptPublicId: p.receiptPublicId || "",
      notes: p.notes || "",
    });
    setShowAddModal(true);
  }

  async function openDetailModal(p: Payment) {
    try {
      const res = await fetch(`/api/admin/payments/${p.id}`);
      const data = await res.json();
      if (data.payment) setDetailPayment(data.payment);
    } catch {
      setDetailPayment(p);
    }
  }

  async function handleFileUpload(file: File) {
    setUploading(true);
    try {
      const fd = new FormData();
      fd.append("receipt", file);
      const res = await fetch("/api/admin/payments/upload", { method: "POST", body: fd });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Upload failed");
      }
      const data = await res.json();
      setFormData((p) => ({ ...p, receiptUrl: data.url, receiptPublicId: data.publicId }));
      setToast({ type: "success", message: "Receipt uploaded" });
    } catch (err) {
      setToast({ type: "error", message: err instanceof Error ? err.message : "Upload failed" });
    } finally {
      setUploading(false);
    }
  }

  async function handleSave() {
    if (!formData.date) { setToast({ type: "error", message: "Date is required" }); return; }
    if (!formData.amount || parseFloat(formData.amount) <= 0) { setToast({ type: "error", message: "Amount must be greater than 0" }); return; }
    if (formData.status === "Completed" && !formData.receiptUrl) { setToast({ type: "error", message: "Receipt is required for completed transactions" }); return; }

    setFormLoading(true);
    try {
      const payload = { ...formData };
      const url = editingPayment ? `/api/admin/payments/${editingPayment.id}` : "/api/admin/payments";
      const method = editingPayment ? "PUT" : "POST";
      const res = await fetch(url, { method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
      if (!res.ok) { const data = await res.json(); throw new Error(data.error || "Failed"); }
      setToast({ type: "success", message: editingPayment ? "Payment updated" : "Payment created" });
      setShowAddModal(false);
      setEditingPayment(null);
      resetForm();
      setRefreshKey((k) => k + 1);
    } catch (err) {
      setToast({ type: "error", message: err instanceof Error ? err.message : "Failed to save" });
    } finally {
      setFormLoading(false);
    }
  }

  const isCompleted = editingPayment?.status === "Completed";
  const isReceiptRequired = formData.status === "Completed";

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
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 pb-2 border-b border-zinc-200 dark:border-zinc-800">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-zinc-900 dark:text-white">Finance & Payments</h1>
          <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5">Track all transactions, revenue, cash flow, and financial records</p>
        </div>
        <div className="flex items-center gap-2.5 w-full sm:w-auto justify-end">
          <button
            onClick={() => setRefreshKey((k) => k + 1)}
            disabled={loading}
            className="px-3.5 py-2 text-xs font-semibold text-zinc-700 dark:text-zinc-300 bg-white dark:bg-zinc-900 hover:bg-slate-50 dark:hover:bg-zinc-800 border border-zinc-200 dark:border-zinc-800 rounded-xl transition flex items-center gap-1.5 shadow-sm cursor-pointer disabled:opacity-60"
          >
            <svg className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0l3.181 3.183a8.25 8.25 0 0013.803-3.7M4.031 9.865a8.25 8.25 0 0113.803-3.7l3.181 3.182" />
            </svg>
            <span>Refresh</span>
          </button>
          {canWrite && (
            <button
              onClick={openAddModal}
              className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-xs font-bold transition flex items-center gap-1.5 shadow-sm cursor-pointer"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
              </svg>
              <span>Record Payment</span>
            </button>
          )}
        </div>
      </div>

      {/* 2. Top Summary KPI Cards (4 Cards) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Card 1: Net Balance */}
        <div className="p-5 bg-white dark:bg-[#111114] border border-zinc-200 dark:border-zinc-800 rounded-2xl shadow-xs relative overflow-hidden flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-zinc-500 dark:text-zinc-400">Net Balance</span>
              <span className="p-1.5 rounded-lg bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400">
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v12m-3-2.818l.879.659c1.171.879 3.07.879 4.242 0 1.172-.879 1.172-2.303 0-3.182C13.536 12.219 12.768 12 12 12c-.725 0-1.45-.22-2.003-.659-1.106-.879-1.106-2.303 0-3.182s2.9-.879 4.006 0l.415.33M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </span>
            </div>
            <div className="flex items-baseline gap-2 mt-2">
              <span className="text-2xl font-bold tracking-tight text-emerald-600 dark:text-emerald-400">
                {summaryLoading ? "..." : formatAmount(String(summary?.netBalance ?? 0), "INR")}
              </span>
            </div>
          </div>
          <div className="mt-3 pt-2">
            <svg className="w-full h-7 text-emerald-500" viewBox="0 0 100 25" fill="none" preserveAspectRatio="none">
              <path d="M0 20 Q 25 24, 45 10 T 80 5 T 100 2" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" />
              <path d="M0 20 Q 25 24, 45 10 T 80 5 T 100 2 L 100 25 L 0 25 Z" fill="currentColor" fillOpacity="0.15" />
            </svg>
          </div>
        </div>

        {/* Card 2: Total Income */}
        <div className="p-5 bg-white dark:bg-[#111114] border border-zinc-200 dark:border-zinc-800 rounded-2xl shadow-xs flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-zinc-500 dark:text-zinc-400">Total Income</span>
            <span className="p-1.5 rounded-lg bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400">
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 10.5L12 3m0 0l7.5 7.5M12 3v18" />
              </svg>
            </span>
          </div>
          <div className="mt-3">
            <p className="text-2xl font-bold text-zinc-900 dark:text-white">
              {summaryLoading ? "..." : formatAmount(String(summary?.totalIncome ?? 0), "INR")}
            </p>
            <p className="text-[11px] text-emerald-600 dark:text-emerald-400 font-semibold mt-1">▲ Inflow revenue</p>
          </div>
        </div>

        {/* Card 3: Total Expenses */}
        <div className="p-5 bg-white dark:bg-[#111114] border border-zinc-200 dark:border-zinc-800 rounded-2xl shadow-xs flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-zinc-500 dark:text-zinc-400">Total Expenses</span>
            <span className="p-1.5 rounded-lg bg-rose-50 dark:bg-rose-950/40 text-rose-600 dark:text-rose-400">
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 13.5L12 21m0 0l-7.5-7.5M12 21V3" />
              </svg>
            </span>
          </div>
          <div className="mt-3">
            <p className="text-2xl font-bold text-zinc-900 dark:text-white">
              {summaryLoading ? "..." : formatAmount(String(summary?.totalExpenses ?? 0), "INR")}
            </p>
            <p className="text-[11px] text-rose-500 dark:text-rose-400 font-semibold mt-1">▼ Outflow spending</p>
          </div>
        </div>

        {/* Card 4: Pending Amount */}
        <div className="p-5 bg-white dark:bg-[#111114] border border-zinc-200 dark:border-zinc-800 rounded-2xl shadow-xs flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-zinc-500 dark:text-zinc-400">Pending / In Review</span>
            <span className="p-1.5 rounded-lg bg-amber-50 dark:bg-amber-950/40 text-amber-600 dark:text-amber-400">
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </span>
          </div>
          <div className="mt-3">
            <p className="text-2xl font-bold text-zinc-900 dark:text-white">
              {summaryLoading ? "..." : formatAmount(String(summary?.pendingAmount ?? 0), "INR")}
            </p>
            <p className="text-[11px] text-amber-600 dark:text-amber-400 font-semibold mt-1">Pending clearance</p>
          </div>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[200px]">
          <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-400 dark:text-zinc-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z" /></svg>
          <input type="text" placeholder="Search by ID, paid by, paid to, reference..." value={search} onChange={(e) => setSearch(e.target.value)} className="w-full bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl pl-10 pr-4 py-2.5 text-sm text-zinc-900 dark:text-zinc-300 placeholder:text-zinc-400 dark:placeholder:text-zinc-600 focus:outline-none focus:ring-2 focus:ring-blue-500/20 dark:focus:ring-zinc-700 hover:border-zinc-300 dark:hover:border-zinc-700 transition shadow-sm" />
        </div>
        <div className="flex flex-wrap items-center gap-2.5">
          <DropdownSelect value={typeFilter} onChange={(v) => { setTypeFilter(v); setPage(1); }} options={[{ label: "All Types", value: "all" }, ...TRANSACTION_TYPES.map((t) => ({ label: t, value: t }))]} />
          <DropdownSelect value={statusFilter} onChange={(v) => { setStatusFilter(v); setPage(1); }} options={[{ label: "All Status", value: "all" }, ...STATUSES.map((s) => ({ label: s, value: s }))]} />
          <DropdownSelect value={methodFilter} onChange={(v) => { setMethodFilter(v); setPage(1); }} options={[{ label: "All Methods", value: "all" }, ...PAYMENT_METHODS.map((m) => ({ label: m, value: m }))]} />
          <div className="flex items-center gap-1.5 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl px-3 py-2 hover:border-zinc-300 dark:hover:border-zinc-700 transition shadow-sm">
            <span className="text-zinc-500 text-xs shrink-0 font-medium">From</span>
            <input type="date" value={startDate} onChange={(e) => { setStartDate(e.target.value); setPage(1); }} className="bg-transparent border-0 text-zinc-800 dark:text-zinc-300 focus:outline-none w-28 text-xs cursor-pointer" />
            <span className="text-zinc-400 text-xs shrink-0">→</span>
            <span className="text-zinc-500 text-xs shrink-0 font-medium">To</span>
            <input type="date" value={endDate} onChange={(e) => { setEndDate(e.target.value); setPage(1); }} className="bg-transparent border-0 text-zinc-800 dark:text-zinc-300 focus:outline-none w-28 text-xs cursor-pointer" />
          </div>
          <DropdownSelect value={`${sortField}-${sortOrder}`} onChange={(v) => { const [f, o] = v.split("-"); setSortField(f); setSortOrder(o); }} options={[{ label: "Newest First", value: "date-desc" }, { label: "Oldest First", value: "date-asc" }, { label: "Amount High-Low", value: "amount-desc" }, { label: "Amount Low-High", value: "amount-asc" }]} />
          <button onClick={() => setRefreshKey((k) => k + 1)} className="flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-zinc-700 dark:text-zinc-300 bg-white dark:bg-zinc-900 hover:bg-slate-50 dark:hover:bg-zinc-800 border border-zinc-200 dark:border-zinc-800 rounded-xl transition cursor-pointer shrink-0 shadow-sm">
            <svg className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0l3.181 3.183a8.25 8.25 0 0013.803-3.7M4.031 9.865a8.25 8.25 0 0113.803-3.7l3.181 3.182" /></svg>
            Refresh
          </button>
        </div>
      </div>

      <div className="bg-white dark:bg-zinc-900/50 border border-zinc-200 dark:border-zinc-800 rounded-2xl overflow-hidden shadow-sm">
        {loading ? (
          <div className="flex items-center justify-center py-20"><div className="w-6 h-6 border-2 border-zinc-400 dark:border-zinc-600 border-t-blue-600 dark:border-t-zinc-300 rounded-full animate-spin" /></div>
        ) : payments.length === 0 ? (
          <div className="text-center py-20"><p className="text-zinc-500 dark:text-zinc-600">No payments found</p></div>
        ) : (
          <>
            <div className="overflow-x-auto" style={{ willChange: "transform" }}>
              <table className="w-full text-sm" style={{ contain: "layout style" }}>
                <thead><tr className="border-b border-zinc-200 dark:border-zinc-800 bg-slate-50 dark:bg-transparent">
                  <th className="text-left px-4 py-3 font-medium text-zinc-600 dark:text-zinc-500">Transaction ID</th>
                  <th className="text-left px-4 py-3 font-medium text-zinc-600 dark:text-zinc-500">Date</th>
                  <th className="text-left px-4 py-3 font-medium text-zinc-600 dark:text-zinc-500">Type</th>
                  <th className="text-right px-4 py-3 font-medium text-zinc-600 dark:text-zinc-500">Amount</th>
                  <th className="text-left px-4 py-3 font-medium text-zinc-600 dark:text-zinc-500">Status</th>
                  <th className="text-left px-4 py-3 font-medium text-zinc-600 dark:text-zinc-500">Method</th>
                  <th className="text-left px-4 py-3 font-medium text-zinc-600 dark:text-zinc-500">Paid By</th>
                  <th className="text-left px-4 py-3 font-medium text-zinc-600 dark:text-zinc-500">Paid To</th>
                  <th className="text-left px-4 py-3 font-medium text-zinc-600 dark:text-zinc-500">Purpose</th>
                  <th className="text-left px-4 py-3 font-medium text-zinc-600 dark:text-zinc-500">Reference</th>
                  <th className="text-right px-4 py-3 font-medium text-zinc-600 dark:text-zinc-500">Actions</th>
                </tr></thead>
                <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800/50">
                  {payments.map((p) => (
                    <tr key={p.id} className="hover:bg-slate-50/80 dark:hover:bg-zinc-800/20 transition-colors">
                      <td className="px-4 py-3 font-mono text-xs text-zinc-700 dark:text-zinc-400">{p.transactionId}</td>
                      <td className="px-4 py-3 text-zinc-600 dark:text-zinc-400 whitespace-nowrap">{new Date(p.date).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}</td>
                      <td className="px-4 py-3"><span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${TYPE_COLORS[p.type] || ""}`}>{p.type}</span></td>
                      <td className="px-4 py-3 text-right font-semibold text-zinc-900 dark:text-white whitespace-nowrap">{formatAmount(p.amount, p.currency)}</td>
                      <td className="px-4 py-3"><span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${STATUS_COLORS[p.status] || ""}`}>{p.status}</span></td>
                      <td className="px-4 py-3 text-zinc-700 dark:text-zinc-400">{p.paymentMethod || "—"}</td>
                      <td className="px-4 py-3 text-zinc-700 dark:text-zinc-400 max-w-[120px] truncate">{p.paidBy || "—"}</td>
                      <td className="px-4 py-3 text-zinc-700 dark:text-zinc-400 max-w-[120px] truncate">{p.paidTo || "—"}</td>
                      <td className="px-4 py-3 text-zinc-700 dark:text-zinc-400 max-w-[120px] truncate">{p.purposeCategory || "—"}</td>
                      <td className="px-4 py-3 text-zinc-700 dark:text-zinc-400 max-w-[120px] truncate">{p.referenceNumber || "—"}</td>
                      <td className="px-4 py-3">
                        <div className="flex items-center justify-end gap-2">
                          <button onClick={() => openDetailModal(p)} className="text-zinc-700 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white text-xs bg-slate-100 dark:bg-zinc-800 hover:bg-slate-200 dark:hover:bg-zinc-700 border border-zinc-200 dark:border-zinc-700/60 px-3 py-1.5 rounded-lg transition cursor-pointer">View</button>
                          {canWrite && <button onClick={() => openEditModal(p)} className="text-zinc-700 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white text-xs bg-slate-100 dark:bg-zinc-800 hover:bg-slate-200 dark:hover:bg-zinc-700 border border-zinc-200 dark:border-zinc-700/60 px-3 py-1.5 rounded-lg transition cursor-pointer">Edit</button>}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {pagination.totalPages > 1 && (
              <div className="flex items-center justify-between px-6 py-4 border-t border-zinc-200 dark:border-zinc-800">
                <p className="text-sm text-zinc-500">Showing {((pagination.page - 1) * pagination.limit) + 1} to {Math.min(pagination.page * pagination.limit, pagination.total)} of {pagination.total}</p>
                <div className="flex items-center gap-2">
                  {Array.from({ length: pagination.totalPages }, (_, i) => i + 1).filter((p) => p === 1 || p === pagination.totalPages || Math.abs(p - page) <= 1).reduce<(number | "ellipsis")[]>((acc, p, i, arr) => { if (i > 0 && p - (arr[i - 1] as number) > 1) acc.push("ellipsis"); acc.push(p); return acc; }, []).map((item, i) => item === "ellipsis" ? (<span key={`e${i}`} className="px-2 text-zinc-600">...</span>) : (<button key={item} onClick={() => setPage(item)} className={`w-8 h-8 text-xs font-semibold rounded-lg transition cursor-pointer ${page === item ? "bg-blue-600 text-white font-bold shadow-xs border border-blue-600" : "text-zinc-700 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white bg-white dark:bg-zinc-900 hover:bg-zinc-100 dark:hover:bg-zinc-800 border border-zinc-200 dark:border-zinc-800"}`}>{item}</button>))}
                  <button onClick={() => setPage(Math.min(pagination.totalPages, page + 1))} disabled={page === pagination.totalPages} className="px-3 py-1.5 text-xs text-zinc-700 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white bg-white dark:bg-zinc-900 hover:bg-zinc-100 dark:hover:bg-zinc-800 border border-zinc-200 dark:border-zinc-800 disabled:opacity-40 disabled:cursor-not-allowed rounded-lg transition cursor-pointer">Next</button>
                </div>
              </div>
            )}
          </>
        )}
      </div>

      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80">
          <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl w-full max-w-lg mx-4 shadow-2xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between px-6 py-5 border-b border-zinc-200 dark:border-zinc-800">
              <h2 className="text-lg font-semibold text-zinc-900 dark:text-white">{editingPayment ? "Edit Payment" : "Add Payment"}</h2>
              <button onClick={() => { setShowAddModal(false); setEditingPayment(null); resetForm(); }} className="text-zinc-400 hover:text-zinc-700 dark:hover:text-white transition text-xl leading-none cursor-pointer w-8 h-8 flex items-center justify-center rounded-lg hover:bg-slate-100 dark:hover:bg-zinc-800">&times;</button>
            </div>
            <div className="px-6 py-5 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-zinc-600 dark:text-zinc-400 block mb-1 text-sm font-medium">Date *</label>
                  <input type="date" value={formData.date} onChange={(e) => setFormData((p) => ({ ...p, date: e.target.value }))} disabled={isCompleted} className="w-full bg-slate-50 dark:bg-zinc-800/50 border border-zinc-200 dark:border-zinc-800 rounded-xl px-4 py-2.5 text-sm text-zinc-900 dark:text-zinc-300 focus:outline-none focus:ring-2 focus:ring-blue-500/20 dark:focus:ring-zinc-700 transition disabled:opacity-50 disabled:cursor-not-allowed" />
                </div>
                <div>
                  <label className="text-zinc-600 dark:text-zinc-400 block mb-1 text-sm font-medium">Transaction Type *</label>
                  <DropdownSelect value={formData.type} onChange={(v) => setFormData((p) => ({ ...p, type: v }))} disabled={isCompleted} options={TRANSACTION_TYPES.map((t) => ({ label: t, value: t }))} className="w-full" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-zinc-600 dark:text-zinc-400 block mb-1 text-sm font-medium">Amount *</label>
                  <input type="number" step="0.01" min="0.01" value={formData.amount} onChange={(e) => setFormData((p) => ({ ...p, amount: e.target.value }))} disabled={isCompleted} placeholder="0.00" className="w-full bg-slate-50 dark:bg-zinc-800/50 border border-zinc-200 dark:border-zinc-800 rounded-xl px-4 py-2.5 text-sm text-zinc-900 dark:text-zinc-300 placeholder:text-zinc-400 dark:placeholder:text-zinc-600 focus:outline-none focus:ring-2 focus:ring-blue-500/20 dark:focus:ring-zinc-700 transition disabled:opacity-50 disabled:cursor-not-allowed" />
                </div>
                <div>
                  <label className="text-zinc-600 dark:text-zinc-400 block mb-1 text-sm font-medium">Currency <span className="text-zinc-400 text-xs">(optional)</span></label>
                  <DropdownSelect value={formData.currency} onChange={(v) => setFormData((p) => ({ ...p, currency: v }))} options={CURRENCIES.map((c) => ({ label: c, value: c }))} className="w-full" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-zinc-600 dark:text-zinc-400 block mb-1 text-sm font-medium">Status *</label>
                  <DropdownSelect value={formData.status} onChange={(v) => setFormData((p) => ({ ...p, status: v }))} options={STATUSES.map((s) => ({ label: s, value: s }))} className="w-full" />
                </div>
                <div>
                  <label className="text-zinc-600 dark:text-zinc-400 block mb-1 text-sm font-medium">Payment Method <span className="text-zinc-400 text-xs">(optional)</span></label>
                  <DropdownSelect value={formData.paymentMethod} onChange={(v) => setFormData((p) => ({ ...p, paymentMethod: v }))} placeholder="Select method" options={PAYMENT_METHODS.map((m) => ({ label: m, value: m }))} className="w-full" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-zinc-600 dark:text-zinc-400 block mb-1 text-sm font-medium">Paid By <span className="text-zinc-400 text-xs">(optional)</span></label>
                  <input type="text" value={formData.paidBy} onChange={(e) => setFormData((p) => ({ ...p, paidBy: e.target.value }))} placeholder="Who paid" className="w-full bg-slate-50 dark:bg-zinc-800/50 border border-zinc-200 dark:border-zinc-800 rounded-xl px-4 py-2.5 text-sm text-zinc-900 dark:text-zinc-300 placeholder:text-zinc-400 dark:placeholder:text-zinc-600 focus:outline-none focus:ring-2 focus:ring-blue-500/20 dark:focus:ring-zinc-700 transition" />
                </div>
                <div>
                  <label className="text-zinc-600 dark:text-zinc-400 block mb-1 text-sm font-medium">Paid To <span className="text-zinc-400 text-xs">(optional)</span></label>
                  <input type="text" value={formData.paidTo} onChange={(e) => setFormData((p) => ({ ...p, paidTo: e.target.value }))} placeholder="Who received" className="w-full bg-slate-50 dark:bg-zinc-800/50 border border-zinc-200 dark:border-zinc-800 rounded-xl px-4 py-2.5 text-sm text-zinc-900 dark:text-zinc-300 placeholder:text-zinc-400 dark:placeholder:text-zinc-600 focus:outline-none focus:ring-2 focus:ring-blue-500/20 dark:focus:ring-zinc-700 transition" />
                </div>
              </div>
              <div>
                <label className="text-zinc-600 dark:text-zinc-400 block mb-1 text-sm font-medium">Purpose / Category <span className="text-zinc-400 text-xs">(optional)</span></label>
                <input type="text" value={formData.purposeCategory} onChange={(e) => setFormData((p) => ({ ...p, purposeCategory: e.target.value }))} placeholder="e.g. Hosting, Software subscription" className="w-full bg-slate-50 dark:bg-zinc-800/50 border border-zinc-200 dark:border-zinc-800 rounded-xl px-4 py-2.5 text-sm text-zinc-900 dark:text-zinc-300 placeholder:text-zinc-400 dark:placeholder:text-zinc-600 focus:outline-none focus:ring-2 focus:ring-blue-500/20 dark:focus:ring-zinc-700 transition" />
              </div>
              <div>
                <label className="text-zinc-600 dark:text-zinc-400 block mb-1 text-sm font-medium">Description <span className="text-zinc-400 text-xs">(optional)</span></label>
                <textarea value={formData.description} onChange={(e) => setFormData((p) => ({ ...p, description: e.target.value }))} rows={2} placeholder="Additional details" className="w-full bg-slate-50 dark:bg-zinc-800/50 border border-zinc-200 dark:border-zinc-800 rounded-xl px-4 py-2.5 text-sm text-zinc-900 dark:text-zinc-300 placeholder:text-zinc-400 dark:placeholder:text-zinc-600 focus:outline-none focus:ring-2 focus:ring-blue-500/20 dark:focus:ring-zinc-700 resize-none transition" />
              </div>
              <div>
                <label className="text-zinc-600 dark:text-zinc-400 block mb-1 text-sm font-medium">Reference / Transaction Number <span className="text-zinc-400 text-xs">(optional)</span></label>
                <input type="text" value={formData.referenceNumber} onChange={(e) => setFormData((p) => ({ ...p, referenceNumber: e.target.value }))} placeholder="UPI Ref, Bank Ref, etc." className="w-full bg-slate-50 dark:bg-zinc-800/50 border border-zinc-200 dark:border-zinc-800 rounded-xl px-4 py-2.5 text-sm text-zinc-900 dark:text-zinc-300 placeholder:text-zinc-400 dark:placeholder:text-zinc-600 focus:outline-none focus:ring-2 focus:ring-blue-500/20 dark:focus:ring-zinc-700 transition" />
              </div>
              <div>
                  <label className="text-zinc-600 dark:text-zinc-400 block mb-1 text-sm font-medium">Receipt / Proof {isReceiptRequired ? <span className="text-amber-500 text-xs">* (required for completed transactions)</span> : <span className="text-zinc-400 text-xs">(optional)</span>}</label>
                  {formData.receiptUrl ? (
                    <div className="flex items-center gap-3 bg-slate-50 dark:bg-zinc-800/50 border border-zinc-200 dark:border-zinc-800 rounded-xl px-4 py-3">
                      {formData.receiptUrl.match(/\.(jpg|jpeg|png|gif|webp)$/i) ? (
                        <img src={formData.receiptUrl} alt="Receipt" className="w-12 h-12 rounded-lg object-cover" />
                      ) : (
                        <div className="w-12 h-12 rounded-lg bg-slate-200 dark:bg-zinc-800 flex items-center justify-center">
                          <svg className="w-6 h-6 text-zinc-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" /></svg>
                        </div>
                      )}
                      <span className="text-sm text-zinc-800 dark:text-zinc-300 truncate flex-1 font-medium">Receipt uploaded</span>
                      <button onClick={() => setFormData((p) => ({ ...p, receiptUrl: "", receiptPublicId: "" }))} className="text-zinc-500 hover:text-red-500 text-xs transition cursor-pointer">Remove</button>
                    </div>
                  ) : (
                    <label className="flex items-center justify-center gap-2 bg-slate-50/50 dark:bg-zinc-800/50 border border-dashed border-zinc-300 dark:border-zinc-700 rounded-xl px-4 py-6 text-sm text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-300 hover:border-zinc-400 dark:hover:border-zinc-600 transition cursor-pointer">
                      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5m-13.5-9L12 3m0 0l4.5 4.5M12 3v13.5" /></svg>
                      {uploading ? "Uploading..." : "Click to upload receipt"}
                      <input type="file" className="hidden" accept="image/*,application/pdf" onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFileUpload(f); }} disabled={uploading} />
                    </label>
                  )}
                </div>
              <div>
                <label className="text-zinc-600 dark:text-zinc-400 block mb-1 text-sm font-medium">Notes <span className="text-zinc-400 text-xs">(optional)</span></label>
                <textarea value={formData.notes} onChange={(e) => setFormData((p) => ({ ...p, notes: e.target.value }))} rows={2} placeholder="Additional notes" className="w-full bg-slate-50 dark:bg-zinc-800/50 border border-zinc-200 dark:border-zinc-800 rounded-xl px-4 py-2.5 text-sm text-zinc-900 dark:text-zinc-300 placeholder:text-zinc-400 dark:placeholder:text-zinc-600 focus:outline-none focus:ring-2 focus:ring-blue-500/20 dark:focus:ring-zinc-700 resize-none transition" />
              </div>
              {isCompleted && editingPayment && (
                <div className="bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-900/50 rounded-xl px-4 py-3 text-sm text-amber-800 dark:text-amber-300">
                  Completed transactions cannot have their amount, type, or date modified.
                </div>
              )}
            </div>
            <div className="flex justify-end gap-3 px-6 py-5 border-t border-zinc-200 dark:border-zinc-800">
              <button onClick={() => { setShowAddModal(false); setEditingPayment(null); resetForm(); }} className="px-4 py-2.5 text-sm text-zinc-700 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white bg-slate-100 dark:bg-zinc-800 hover:bg-slate-200 dark:hover:bg-zinc-700 rounded-xl transition cursor-pointer">Cancel</button>
              <button onClick={handleSave} disabled={formLoading || uploading} className="btn-primary px-5 py-2.5 text-sm disabled:opacity-40 disabled:cursor-not-allowed">{formLoading ? "Saving..." : editingPayment ? "Update" : "Create"}</button>
            </div>
          </div>
        </div>
      )}

      {detailPayment && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 animate-in fade-in duration-150">
          <div className="bg-white dark:bg-[#131316] border border-zinc-200 dark:border-zinc-700/70 rounded-3xl w-full max-w-xl shadow-2xl max-h-[92vh] flex flex-col overflow-hidden animate-in zoom-in-95 duration-150">
            
            {/* Modal Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-zinc-200 dark:border-zinc-800/80 bg-slate-50 dark:bg-zinc-900/40">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-blue-50 dark:bg-zinc-800/90 border border-blue-200 dark:border-zinc-700/70 flex items-center justify-center text-blue-600 dark:text-zinc-300 shadow-sm">
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 18.75a60.07 60.07 0 0115.797 2.101c.727.198 1.453-.342 1.453-1.096V18.75M3.75 4.5v.75A.75.75 0 013 6H2.25m0 0H3m-.75 0h.75m0 0H18A2.25 2.25 0 0120.25 8.25v8.25m-18 0V21m0-12.75h18m-18 0v12.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </div>
                <div>
                  <h2 className="text-base font-bold text-zinc-900 dark:text-white tracking-tight">Transaction Receipt</h2>
                  <p className="text-xs text-zinc-500 dark:text-zinc-400 font-mono flex items-center gap-1.5 mt-0.5">
                    <span>{detailPayment.transactionId}</span>
                    <CopyButton text={detailPayment.transactionId} label="Copy ID" />
                  </p>
                </div>
              </div>
              <button
                onClick={() => setDetailPayment(null)}
                className="text-zinc-400 hover:text-zinc-700 dark:hover:text-white transition w-9 h-9 flex items-center justify-center rounded-xl bg-slate-100 dark:bg-zinc-800/60 hover:bg-slate-200 dark:hover:bg-zinc-800 border border-zinc-200 dark:border-zinc-700/50 cursor-pointer"
                title="Close"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {/* Modal Body */}
            <div className="px-6 py-5 space-y-4 overflow-y-auto flex-1">
              
              {/* Hero Amount Banner */}
              <div className="bg-slate-50 dark:bg-zinc-900/80 border border-zinc-200 dark:border-zinc-700/60 rounded-2xl p-5 shadow-xs">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div>
                    <span className="text-[11px] uppercase tracking-wider text-zinc-500 dark:text-zinc-400 font-semibold block mb-1">Total Amount</span>
                    <div className="text-3xl sm:text-4xl font-extrabold text-zinc-900 dark:text-white tracking-tight">
                      {formatAmount(detailPayment.amount, detailPayment.currency)}
                    </div>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold ${TYPE_COLORS[detailPayment.type] || "bg-zinc-800 text-zinc-300"}`}>
                      <span className="w-1.5 h-1.5 rounded-full bg-current opacity-80" />
                      {detailPayment.type}
                    </span>
                    <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold ${STATUS_COLORS[detailPayment.status] || "bg-zinc-800 text-zinc-300"}`}>
                      {detailPayment.status === "Completed" && <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 dark:bg-emerald-400" />}
                      {detailPayment.status === "Pending" && <span className="w-1.5 h-1.5 rounded-full bg-amber-500 dark:bg-amber-400" />}
                      {detailPayment.status}
                    </span>
                  </div>
                </div>

                <div className="mt-4 pt-3.5 border-t border-zinc-200 dark:border-zinc-700/50 flex flex-wrap items-center justify-between gap-2 text-xs text-zinc-600 dark:text-zinc-400">
                  <div className="flex items-center gap-1.5">
                    <svg className="w-3.5 h-3.5 text-zinc-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 012.25-2.25h13.5A2.25 2.25 0 0121 7.5v11.25m-18 0A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75m-18 0v-7.5A2.25 2.25 0 015.25 9h13.5A2.25 2.25 0 0121 9v7.5" />
                    </svg>
                    <span>{new Date(detailPayment.date).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })}</span>
                  </div>
                  {detailPayment.paymentMethod && (
                    <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-md bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700/60 text-zinc-700 dark:text-zinc-300 font-medium shadow-2xs">
                      💳 {detailPayment.paymentMethod}
                    </span>
                  )}
                </div>
              </div>

              {/* Transfer Flow Card (Paid By -> Paid To) */}
              {(detailPayment.paidBy || detailPayment.paidTo) && (
                <div className="bg-slate-50 dark:bg-zinc-900/60 border border-zinc-200 dark:border-zinc-800 rounded-2xl p-4">
                  <span className="text-[11px] uppercase tracking-wider text-zinc-500 dark:text-zinc-400 font-semibold block mb-3">Party Information</span>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 relative">
                    
                    {/* Paid By */}
                    <div className="bg-white dark:bg-zinc-800/40 border border-zinc-200 dark:border-zinc-700/50 rounded-xl p-3 flex items-center justify-between gap-3 shadow-2xs">
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="w-8 h-8 rounded-full bg-emerald-50 dark:bg-emerald-500/10 border border-emerald-200 dark:border-emerald-500/30 flex items-center justify-center text-xs font-bold text-emerald-600 dark:text-emerald-400 shrink-0">
                          {(detailPayment.paidBy || "U").charAt(0).toUpperCase()}
                        </div>
                        <div className="min-w-0">
                          <span className="text-[10px] text-zinc-500 uppercase tracking-wider block font-medium">Paid By</span>
                          <span className="text-sm font-semibold text-zinc-900 dark:text-zinc-200 truncate block">
                            {detailPayment.paidBy || "—"}
                          </span>
                        </div>
                      </div>
                      {detailPayment.paidBy && <CopyButton text={detailPayment.paidBy} label="Copy Name" />}
                    </div>

                    {/* Paid To */}
                    <div className="bg-white dark:bg-zinc-800/40 border border-zinc-200 dark:border-zinc-700/50 rounded-xl p-3 flex items-center justify-between gap-3 shadow-2xs">
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="w-8 h-8 rounded-full bg-blue-50 dark:bg-blue-500/10 border border-blue-200 dark:border-blue-500/30 flex items-center justify-center text-xs font-bold text-blue-600 dark:text-blue-400 shrink-0">
                          {(detailPayment.paidTo || "U").charAt(0).toUpperCase()}
                        </div>
                        <div className="min-w-0">
                          <span className="text-[10px] text-zinc-500 uppercase tracking-wider block font-medium">Paid To</span>
                          <span className="text-sm font-semibold text-zinc-900 dark:text-zinc-200 truncate block">
                            {detailPayment.paidTo || "—"}
                          </span>
                        </div>
                      </div>
                      {detailPayment.paidTo && <CopyButton text={detailPayment.paidTo} label="Copy Name" />}
                    </div>

                  </div>
                </div>
              )}

              {/* Specs & Identifiers Card */}
              <div className="bg-slate-50 dark:bg-zinc-900/60 border border-zinc-200 dark:border-zinc-800 rounded-2xl p-4 space-y-3">
                <span className="text-[11px] uppercase tracking-wider text-zinc-500 dark:text-zinc-400 font-semibold block">Details & References</span>
                
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
                  
                  {/* Reference Number */}
                  <div className="bg-white dark:bg-zinc-800/40 border border-zinc-200 dark:border-zinc-800 rounded-xl p-3 shadow-2xs">
                    <div className="flex items-center justify-between text-xs text-zinc-500 dark:text-zinc-400 mb-1">
                      <span className="font-medium">Reference / UTR No</span>
                      {detailPayment.referenceNumber && <CopyButton text={detailPayment.referenceNumber} label="Copy Ref" />}
                    </div>
                    <div className="font-mono text-sm text-zinc-900 dark:text-zinc-200 font-semibold break-all">
                      {detailPayment.referenceNumber || "—"}
                    </div>
                  </div>

                  {/* Purpose / Category */}
                  <div className="bg-white dark:bg-zinc-800/40 border border-zinc-200 dark:border-zinc-800 rounded-xl p-3 shadow-2xs">
                    <div className="flex items-center justify-between text-xs text-zinc-500 dark:text-zinc-400 mb-1">
                      <span className="font-medium">Purpose / Category</span>
                      {detailPayment.purposeCategory && <CopyButton text={detailPayment.purposeCategory} label="Copy Category" />}
                    </div>
                    <div className="text-sm text-zinc-900 dark:text-zinc-200 font-medium truncate">
                      {detailPayment.purposeCategory ? (
                        <span className="inline-flex items-center px-2 py-0.5 rounded-md text-xs bg-slate-100 dark:bg-zinc-700/60 text-zinc-800 dark:text-zinc-200 border border-zinc-200 dark:border-zinc-600/50 font-medium">
                          {detailPayment.purposeCategory}
                        </span>
                      ) : "—"}
                    </div>
                  </div>

                </div>

                {/* Description */}
                {detailPayment.description && (
                  <div className="bg-white dark:bg-zinc-800/40 border border-zinc-200 dark:border-zinc-800 rounded-xl p-3 shadow-2xs">
                    <span className="text-xs text-zinc-500 dark:text-zinc-400 block mb-1.5 font-medium">Description</span>
                    <p className="text-xs text-zinc-700 dark:text-zinc-300 leading-relaxed whitespace-pre-wrap">
                      {detailPayment.description}
                    </p>
                  </div>
                )}

                {/* Notes */}
                {detailPayment.notes && (
                  <div className="bg-white dark:bg-zinc-800/40 border border-zinc-200 dark:border-zinc-800 rounded-xl p-3 shadow-2xs">
                    <div className="flex items-center justify-between text-xs text-zinc-500 dark:text-zinc-400 mb-1.5">
                      <span className="font-medium">Internal Notes</span>
                      <CopyButton text={detailPayment.notes} label="Copy Notes" />
                    </div>
                    <p className="text-xs text-zinc-700 dark:text-zinc-300 leading-relaxed whitespace-pre-wrap">
                      {detailPayment.notes}
                    </p>
                  </div>
                )}

                {/* Receipt / Proof Section */}
                {detailPayment.receiptUrl && (
                  <div className="bg-white dark:bg-zinc-800/40 border border-zinc-200 dark:border-zinc-800 rounded-xl p-3 shadow-2xs">
                    <span className="text-xs text-zinc-500 dark:text-zinc-400 block mb-2 font-medium">Receipt / Payment Proof</span>
                    <div className="flex items-center gap-3">
                      {detailPayment.receiptUrl.match(/\.(jpg|jpeg|png|gif|webp)$/i) ? (
                        <a href={detailPayment.receiptUrl} target="_blank" rel="noopener noreferrer" className="relative group block rounded-lg overflow-hidden border border-zinc-200 dark:border-zinc-700/60 shrink-0">
                          <img src={detailPayment.receiptUrl} alt="Receipt" className="w-14 h-14 object-cover group-hover:scale-105 transition duration-200" />
                          <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition flex items-center justify-center text-white">
                            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M13.5 6H5.25A2.25 2.25 0 003 8.25v10.5A2.25 2.25 0 005.25 21h10.5A2.25 2.25 0 0018 18.75V10.5m-10.5 6L21 3m0 0h-5.25M21 3v5.25" /></svg>
                          </div>
                        </a>
                      ) : (
                        <div className="w-14 h-14 rounded-lg bg-slate-100 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700/60 flex items-center justify-center text-zinc-500 dark:text-zinc-400 shrink-0">
                          <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" /></svg>
                        </div>
                      )}
                      <div>
                        <a
                          href={detailPayment.receiptUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1.5 text-xs font-semibold text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 hover:underline"
                        >
                          <span>Open Full Receipt Document</span>
                          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M13.5 6H5.25A2.25 2.25 0 003 8.25v10.5A2.25 2.25 0 005.25 21h10.5A2.25 2.25 0 0018 18.75V10.5m-10.5 6L21 3m0 0h-5.25M21 3v5.25" /></svg>
                        </a>
                        <p className="text-[11px] text-zinc-500 mt-0.5">Uploaded proof of transaction</p>
                      </div>
                    </div>
                  </div>
                )}

              </div>

              {/* Timestamps */}
              <div className="flex flex-wrap items-center justify-between gap-2 px-1 text-[11px] text-zinc-500 dark:text-zinc-400">
                <span>Created: {new Date(detailPayment.createdAt).toLocaleString()}</span>
                <span>Updated: {new Date(detailPayment.updatedAt).toLocaleString()}</span>
              </div>

            </div>

            {/* Modal Footer */}
            <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-zinc-200 dark:border-zinc-800/80 bg-slate-50 dark:bg-zinc-900/40">
              <button
                onClick={() => setDetailPayment(null)}
                className="px-4 py-2.5 text-sm font-medium text-zinc-700 dark:text-zinc-300 hover:text-zinc-900 dark:hover:text-white bg-slate-200/80 dark:bg-zinc-800 hover:bg-slate-300 dark:hover:bg-zinc-700 border border-zinc-300 dark:border-zinc-700/60 rounded-xl transition cursor-pointer shadow-2xs"
              >
                Close
              </button>
              {canWrite && (
                <button
                  onClick={() => {
                    const p = detailPayment;
                    setDetailPayment(null);
                    openEditModal(p);
                  }}
                  className="btn-primary px-5 py-2.5 text-sm gap-1.5"
                >
                  <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L10.582 16.07a4.5 4.5 0 01-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 011.13-1.897l8.932-8.931zm0 0L19.5 7.125M18 14v4.75A2.25 2.25 0 0115.75 21H5.25A2.25 2.25 0 013 18.75V7.5A2.25 2.25 0 015.25 5.25H10" />
                  </svg>
                  <span>Edit Transaction</span>
                </button>
              )}
            </div>

          </div>
        </div>
      )}

    </div>
  );
}
