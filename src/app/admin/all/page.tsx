"use client";

import { useState, useEffect, useRef } from "react";
import { hasWritePermission } from "@/lib/permissions";

interface ContactEnquiry {
  id: string;
  name: string;
  email: string;
  message: string;
  platform: string;
  replied: boolean;
  replyMessage: string | null;
  seen: boolean;
  seenAt: string | null;
  createdAt: string;
  updatedAt: string;
}

interface Pagination {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

export default function AllFormsPage() {
  const [enquiries, setEnquiries] = useState<ContactEnquiry[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [page, setPage] = useState(1);
  const [pagination, setPagination] = useState<Pagination>({ page: 1, limit: 20, total: 0, totalPages: 0 });
  const [selectedEnquiry, setSelectedEnquiry] = useState<ContactEnquiry | null>(null);
  const [replyText, setReplyText] = useState("");
  const [sending, setSending] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<ContactEnquiry | null>(null);
  const [viewOnly, setViewOnly] = useState(true);
  const [toast, setToast] = useState<{ type: "success" | "error"; message: string } | null>(null);
  const [canWrite, setCanWrite] = useState(true);
  const initialLoadDone = useRef(false);

  useEffect(() => {
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
    let cancelled = false;
    if (initialLoadDone.current) setLoading(true);
    const params = new URLSearchParams();
    if (debouncedSearch) params.set("search", debouncedSearch);
    params.set("page", String(page)); params.set("limit", "20");
    fetch(`/api/admin/enquiries?${params}`).then((r) => r.json())
      .then((data) => { if (!cancelled) { setEnquiries(data.enquiries || []); setPagination(data.pagination); } })
      .catch(() => { if (!cancelled) setToast({ type: "error", message: "Failed to load enquiries" }); })
      .finally(() => { if (!cancelled) { setLoading(false); initialLoadDone.current = true; } });
    return () => { cancelled = true; };
  }, [debouncedSearch, page, refreshKey]);

  async function handleReply() {
    if (!selectedEnquiry || !replyText.trim()) return;
    setSending(true);
    try {
      const res = await fetch("/api/admin/reply", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ enquiryId: selectedEnquiry.id, replyBody: replyText }) });
      if (!res.ok) throw new Error("Failed");
      setToast({ type: "success", message: `Reply sent to ${selectedEnquiry.email}` });
      setSelectedEnquiry(null); setReplyText(""); setRefreshKey((k) => k + 1);
    } catch { setToast({ type: "error", message: "Failed to send reply" }); } finally { setSending(false); }
  }

  async function confirmDelete() {
    if (!deleteTarget) return;
    const id = deleteTarget.id;
    setDeleting(id);
    try {
      const res = await fetch(`/api/admin/enquiries?id=${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Failed");
      setToast({ type: "success", message: "Enquiry deleted" });
      setDeleteTarget(null);
      setRefreshKey((k) => k + 1);
    } catch {
      setToast({ type: "error", message: "Failed to delete" });
    } finally {
      setDeleting(null);
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


      <div>
        <h1 className="text-lg font-bold tracking-tight text-zinc-900 dark:text-white">All Forms</h1>
        <p className="text-zinc-500 text-sm">All contact form enquiries</p>
      </div>

      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-400 dark:text-zinc-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z" /></svg>
          <input type="text" placeholder="Search by name, email, or message..." value={search} onChange={(e) => setSearch(e.target.value)} className="w-full bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl pl-10 pr-4 py-2.5 text-sm text-zinc-900 dark:text-zinc-300 placeholder:text-zinc-400 dark:placeholder:text-zinc-600 focus:outline-none focus:ring-2 focus:ring-blue-500/20 dark:focus:ring-zinc-700 transition shadow-sm" />
        </div>
        <button onClick={() => setRefreshKey((k) => k + 1)} className="flex items-center gap-2 px-4 py-2.5 text-sm font-medium text-zinc-700 dark:text-zinc-300 bg-white dark:bg-zinc-900 hover:bg-slate-50 dark:hover:bg-zinc-800 border border-zinc-200 dark:border-zinc-800 rounded-xl transition cursor-pointer shadow-sm">
          <svg className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0l3.181 3.183a8.25 8.25 0 0013.803-3.7M4.031 9.865a8.25 8.25 0 0113.803-3.7l3.181 3.182" /></svg>
          Refresh
        </button>
      </div>

      <div className="bg-white dark:bg-zinc-900/50 border border-zinc-200 dark:border-zinc-800 rounded-2xl overflow-hidden shadow-sm">
        {loading ? (
          <div className="flex items-center justify-center py-20"><div className="w-6 h-6 border-2 border-zinc-400 dark:border-zinc-600 border-t-blue-600 dark:border-t-zinc-300 rounded-full animate-spin" /></div>
        ) : enquiries.length === 0 ? (
          <div className="text-center py-20"><p className="text-zinc-500 dark:text-zinc-600">No enquiries found</p></div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead><tr className="border-b border-zinc-200 dark:border-zinc-800 bg-slate-50 dark:bg-transparent">
                  <th className="text-left px-6 py-4 font-medium text-zinc-600 dark:text-zinc-500">Name</th>
                  <th className="text-left px-6 py-4 font-medium text-zinc-600 dark:text-zinc-500">Email</th>
                  <th className="text-left px-6 py-4 font-medium text-zinc-600 dark:text-zinc-500">Platform</th>
                  <th className="text-left px-6 py-4 font-medium text-zinc-600 dark:text-zinc-500">Message</th>
                  <th className="text-left px-6 py-4 font-medium text-zinc-600 dark:text-zinc-500">Status</th>
                  <th className="text-left px-6 py-4 font-medium text-zinc-600 dark:text-zinc-500">Date</th>
                  <th className="text-right px-6 py-4 font-medium text-zinc-600 dark:text-zinc-500">Actions</th>
                </tr></thead>
                <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800/50">
                  {enquiries.map((enq) => (
                    <tr key={enq.id} className="hover:bg-slate-50/80 dark:hover:bg-zinc-800/20 transition-colors">
                      <td className="px-6 py-4"><div className="flex items-center gap-3"><div className="w-8 h-8 rounded-full bg-slate-100 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 flex items-center justify-center text-xs font-medium text-zinc-700 dark:text-zinc-400 shrink-0">{enq.name.charAt(0).toUpperCase()}</div><span className="font-medium text-zinc-900 dark:text-white">{enq.name}</span></div></td>
                      <td className="px-6 py-4 text-zinc-700 dark:text-zinc-400">{enq.email}</td>
                      <td className="px-6 py-4"><span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-slate-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 border border-zinc-200 dark:border-zinc-700">{enq.platform}</span></td>
                      <td className="px-6 py-4 text-zinc-600 dark:text-zinc-400 max-w-xs truncate">{enq.message.length > 60 ? enq.message.slice(0, 60) + "..." : enq.message}</td>
                      <td className="px-6 py-4">
                        {enq.replied ? (
                          enq.seen ? (<span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-50 dark:bg-blue-950/50 text-blue-700 dark:text-blue-400 border border-blue-200 dark:border-blue-800/50">Seen</span>)
                          : (<span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-emerald-50 dark:bg-emerald-950/50 text-emerald-700 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800/50">Replied</span>)
                        ) : (<span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-amber-50 dark:bg-amber-950/50 text-amber-700 dark:text-amber-400 border border-amber-200 dark:border-amber-800/50">Pending</span>)}
                      </td>
                      <td className="px-6 py-4 text-zinc-500 whitespace-nowrap">{new Date(enq.createdAt).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}</td>
                      <td className="px-6 py-4"><div className="flex items-center justify-end gap-2">
                        <button onClick={() => { setSelectedEnquiry(enq); setReplyText(""); setViewOnly(true); }} className="text-zinc-700 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white text-xs bg-slate-100 dark:bg-zinc-800 hover:bg-slate-200 dark:hover:bg-zinc-700 border border-zinc-200 dark:border-zinc-700/60 px-3 py-1.5 rounded-lg transition cursor-pointer">View</button>
                        {canWrite && !enq.replied && <button onClick={() => { setSelectedEnquiry(enq); setReplyText(""); setViewOnly(false); }} className="btn-primary text-xs px-3 py-1.5 rounded-lg transition cursor-pointer">Reply</button>}
                        {canWrite && <button onClick={() => setDeleteTarget(enq)} disabled={deleting === enq.id} className="text-zinc-400 hover:text-red-600 dark:hover:text-red-400 text-xs bg-slate-100 dark:bg-zinc-800 hover:bg-red-50 dark:hover:bg-red-950/50 border border-zinc-200 dark:border-zinc-700/60 px-3 py-1.5 rounded-lg transition cursor-pointer disabled:opacity-40">{deleting === enq.id ? "..." : "Delete"}</button>}
                      </div></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {pagination.totalPages > 1 && (
              <div className="flex items-center justify-between px-6 py-4 border-t border-zinc-200 dark:border-zinc-800">
                <p className="text-sm text-zinc-500">Showing {((pagination.page - 1) * pagination.limit) + 1} to {Math.min(pagination.page * pagination.limit, pagination.total)} of {pagination.total}</p>
                <div className="flex items-center gap-2">
                  <button onClick={() => setPage(Math.max(1, page - 1))} disabled={page === 1} className="px-3 py-1.5 text-xs text-zinc-700 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white bg-white dark:bg-zinc-900 hover:bg-zinc-100 dark:hover:bg-zinc-800 border border-zinc-200 dark:border-zinc-800 disabled:opacity-40 disabled:cursor-not-allowed rounded-lg transition cursor-pointer">Previous</button>
                  {Array.from({ length: pagination.totalPages }, (_, i) => i + 1).filter((p) => p === 1 || p === pagination.totalPages || Math.abs(p - page) <= 1).reduce<(number | "ellipsis")[]>((acc, p, i, arr) => { if (i > 0 && p - (arr[i - 1] as number) > 1) acc.push("ellipsis"); acc.push(p); return acc; }, []).map((item, i) => item === "ellipsis" ? (<span key={`e${i}`} className="px-2 text-zinc-600">...</span>) : (<button key={item} onClick={() => setPage(item)} className={`w-8 h-8 text-xs font-semibold rounded-lg transition cursor-pointer ${page === item ? "bg-blue-600 text-white font-bold shadow-xs border border-blue-600" : "text-zinc-700 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white bg-white dark:bg-zinc-900 hover:bg-zinc-100 dark:hover:bg-zinc-800 border border-zinc-200 dark:border-zinc-800"}`}>{item}</button>))}
                  <button onClick={() => setPage(Math.min(pagination.totalPages, page + 1))} disabled={page === pagination.totalPages} className="px-3 py-1.5 text-xs text-zinc-700 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white bg-white dark:bg-zinc-900 hover:bg-zinc-100 dark:hover:bg-zinc-800 border border-zinc-200 dark:border-zinc-800 disabled:opacity-40 disabled:cursor-not-allowed rounded-lg transition cursor-pointer">Next</button>
                </div>
              </div>
            )}
          </>
        )}
      </div>

      {selectedEnquiry && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80">
          <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl w-full max-w-lg mx-4 shadow-2xl">
            <div className="flex items-center justify-between px-6 py-5 border-b border-zinc-200 dark:border-zinc-800">
              <h2 className="text-lg font-semibold text-zinc-900 dark:text-white">{viewOnly ? "Enquiry Details" : selectedEnquiry.replied ? "Enquiry Details" : "Reply to Enquiry"}</h2>
              <button onClick={() => { setSelectedEnquiry(null); setReplyText(""); }} className="text-zinc-400 hover:text-zinc-700 dark:hover:text-white transition text-xl leading-none cursor-pointer w-8 h-8 flex items-center justify-center rounded-lg hover:bg-slate-100 dark:hover:bg-zinc-800">&times;</button>
            </div>
            <div className="px-6 py-5 space-y-4">
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div><span className="text-zinc-500 block mb-1">Name</span><span className="font-medium text-zinc-900 dark:text-white">{selectedEnquiry.name}</span></div>
                <div><span className="text-zinc-500 block mb-1">Email</span><span className="font-medium text-zinc-900 dark:text-white">{selectedEnquiry.email}</span></div>
                <div><span className="text-zinc-500 block mb-1">Platform</span><span className="font-medium text-zinc-900 dark:text-white">{selectedEnquiry.platform}</span></div>
                <div><span className="text-zinc-500 block mb-1">Date</span><span className="font-medium text-zinc-900 dark:text-white">{new Date(selectedEnquiry.createdAt).toLocaleString()}</span></div>
              </div>
              <div><span className="text-zinc-500 block mb-1 text-sm">Message</span><div className="bg-slate-50 dark:bg-zinc-800/50 border border-zinc-200 dark:border-zinc-800 rounded-xl p-4 text-sm text-zinc-800 dark:text-zinc-300 whitespace-pre-wrap">{selectedEnquiry.message}</div></div>
              {selectedEnquiry.replied && selectedEnquiry.replyMessage && (
                <div>
                  <span className="text-zinc-500 block mb-1 text-sm">Previous Reply</span>
                  <div className="bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-900/50 rounded-xl p-4 text-sm text-emerald-800 dark:text-emerald-300 whitespace-pre-wrap">{selectedEnquiry.replyMessage}</div>
                  {selectedEnquiry.seen ? (<div className="flex items-center gap-2 mt-2 text-xs text-indigo-600 dark:text-indigo-400">Seen {selectedEnquiry.seenAt ? `at ${new Date(selectedEnquiry.seenAt).toLocaleString()}` : ""}</div>) : (<div className="flex items-center gap-2 mt-2 text-xs text-zinc-500">Not yet seen</div>)}
                </div>
              )}
              {!viewOnly && !selectedEnquiry.replied && (
                <div><span className="text-zinc-600 dark:text-zinc-400 block mb-1 text-sm font-medium">Your Reply</span><textarea value={replyText} onChange={(e) => setReplyText(e.target.value)} rows={4} placeholder="Type your reply..." className="w-full bg-slate-50 dark:bg-zinc-800/50 border border-zinc-200 dark:border-zinc-800 rounded-xl px-4 py-3 text-sm text-zinc-900 dark:text-zinc-300 placeholder:text-zinc-400 dark:placeholder:text-zinc-600 focus:outline-none focus:ring-2 focus:ring-zinc-400 dark:focus:ring-zinc-700 resize-none transition" /></div>
              )}
            </div>
            <div className="flex justify-end gap-3 px-6 py-5 border-t border-zinc-200 dark:border-zinc-800">
              <button onClick={() => { setSelectedEnquiry(null); setReplyText(""); }} className="px-4 py-2.5 text-sm text-zinc-700 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white bg-slate-100 dark:bg-zinc-800 hover:bg-slate-200 dark:hover:bg-zinc-700 rounded-xl transition cursor-pointer">Close</button>
              {!viewOnly && !selectedEnquiry.replied && (<button onClick={handleReply} disabled={sending || !replyText.trim()} className="btn-primary px-5 py-2.5 text-sm">{sending ? "Sending..." : "Send Reply"}</button>)}
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation Popup Modal */}
      {deleteTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 animate-in fade-in duration-150">
          <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl w-full max-w-sm shadow-2xl p-6 text-center space-y-4 animate-in zoom-in-95 duration-150">
            <div className="w-12 h-12 rounded-full bg-red-100 dark:bg-red-950/50 text-red-600 dark:text-red-400 mx-auto flex items-center justify-center border border-red-200 dark:border-red-900/50">
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
            <div className="flex gap-2 pt-2">
              <button
                onClick={() => setDeleteTarget(null)}
                disabled={Boolean(deleting)}
                className="flex-1 px-4 py-2 text-xs font-semibold text-zinc-700 dark:text-zinc-300 bg-zinc-100 hover:bg-zinc-200 dark:bg-zinc-800 dark:hover:bg-zinc-700 rounded-xl transition cursor-pointer"
              >
                Cancel
              </button>
              <button
                onClick={confirmDelete}
                disabled={Boolean(deleting)}
                className="flex-1 px-4 py-2 text-xs font-semibold text-white bg-red-600 hover:bg-red-700 rounded-xl transition cursor-pointer shadow-sm disabled:opacity-50"
              >
                {deleting ? "Deleting..." : "Delete"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
