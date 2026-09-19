"use client";
import { useState, useMemo } from "react";
import type { Lead, LeadColumn, LeadComment } from "../../types";

export default function ViewLeadModal({
  lead,
  columns = [],
  rowIndex,
  onClose,
  onLeadUpdated,
}: {
  lead: Lead;
  columns?: LeadColumn[];
  rowIndex?: number;
  onClose: () => void;
  onLeadUpdated?: (updated: Lead) => void;
}) {
  const [commentInput, setCommentInput] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Parse existing comments from lead.notes
  const comments: LeadComment[] = useMemo(() => {
    if (!lead.notes) return [];
    try {
      const parsed = JSON.parse(lead.notes);
      if (Array.isArray(parsed)) return parsed;
      if (typeof parsed === "string" && parsed.trim()) {
        return [
          {
            id: "legacy-1",
            authorName: "Admin",
            authorEmail: "admin",
            authorRole: "admin",
            text: parsed,
            createdAt: lead.createdAt,
          },
        ];
      }
    } catch {
      if (typeof lead.notes === "string" && lead.notes.trim()) {
        return [
          {
            id: "legacy-1",
            authorName: "Admin",
            authorEmail: "admin",
            authorRole: "admin",
            text: lead.notes,
            createdAt: lead.createdAt,
          },
        ];
      }
    }
    return [];
  }, [lead.notes, lead.createdAt]);

  // Extract dynamic row cells according to columns list
  const rowCells = useMemo(() => {
    if (columns.length > 0) {
      return columns.map((col) => {
        const colName = col.name;
        const colKey = colName.toLowerCase().replace(/[^a-z0-9]/g, "");
        let val = "";

        if (lead.customFields && lead.customFields[colName] !== undefined) {
          val = lead.customFields[colName];
        } else if (lead.customFields && lead.customFields[colKey] !== undefined) {
          val = lead.customFields[colKey];
        } else if ((lead as unknown as Record<string, unknown>)[colKey] !== undefined) {
          val = String((lead as unknown as Record<string, unknown>)[colKey] ?? "");
        } else if ((lead as unknown as Record<string, unknown>)[colName] !== undefined) {
          val = String((lead as unknown as Record<string, unknown>)[colName] ?? "");
        } else if (colKey === "businessname") {
          val = lead.businessName || "";
        }

        return {
          name: colName,
          value: val || "—",
        };
      });
    }

    // Fallback if no columns provided
    const items: { name: string; value: string }[] = [];
    if (lead.businessName) items.push({ name: "Business / Title", value: lead.businessName });
    if (lead.phone) items.push({ name: "Phone", value: lead.phone });
    if (lead.email) items.push({ name: "Email", value: lead.email });
    if (lead.status) items.push({ name: "Status", value: lead.status });

    if (lead.customFields && typeof lead.customFields === "object") {
      Object.entries(lead.customFields).forEach(([k, v]) => {
        items.push({ name: k, value: String(v || "—") });
      });
    }

    return items;
  }, [columns, lead]);

  async function handleAddComment() {
    if (!commentInput.trim() || saving) return;
    setSaving(true);
    setError(null);

    try {
      const res = await fetch(`/api/admin/leads/${lead.id}/remark`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ commentText: commentInput.trim() }),
      });

      if (!res.ok) {
        throw new Error("Failed to post comment");
      }

      const data = await res.json();
      setCommentInput("");
      if (onLeadUpdated && data.lead) {
        onLeadUpdated(data.lead);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to post comment");
    } finally {
      setSaving(false);
    }
  }

  async function handleDeleteComment(commentId: string) {
    if (saving) return;
    setSaving(true);
    setError(null);

    try {
      const res = await fetch(`/api/admin/leads/${lead.id}/remark`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ deleteCommentId: commentId }),
      });

      if (!res.ok) {
        throw new Error("Failed to remove comment");
      }

      const data = await res.json();
      if (onLeadUpdated && data.lead) {
        onLeadUpdated(data.lead);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to remove comment");
    } finally {
      setSaving(false);
    }
  }

  function formatTime(iso: string) {
    try {
      const d = new Date(iso);
      return d.toLocaleString("en-IN", {
        dateStyle: "medium",
        timeStyle: "short",
      });
    } catch {
      return iso;
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 animate-in fade-in duration-150">
      <div className="fixed inset-0" onClick={onClose} />
      <div className="relative bg-white dark:bg-[#111114] border border-zinc-200 dark:border-zinc-700/80 rounded-2xl w-full max-w-2xl shadow-2xl overflow-hidden z-10 animate-in zoom-in-95 duration-150 flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-zinc-200 dark:border-zinc-800 shrink-0 bg-slate-50 dark:bg-zinc-900/50">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-blue-50 dark:bg-blue-500/15 border border-blue-200 dark:border-blue-500/30 text-blue-600 dark:text-blue-400 flex items-center justify-center font-bold shrink-0">
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M8.625 12a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0H8.25m4.125 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0H12m4.125 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0h-.375M21 12c0 4.556-4.03 8.25-9 8.25a9.764 9.764 0 01-2.555-.337A5.972 5.972 0 015.41 20.97a.75.75 0 01-.817-.817 5.972 5.972 0 011.057-3.035C4.03 15.556 3 13.556 3 12c0-4.556 4.03-8.25 9-8.25s9 3.694 9 8.25z" />
              </svg>
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base font-bold text-zinc-900 dark:text-white leading-tight">
                  Row {rowIndex !== undefined ? `#${rowIndex + 1}` : ""} Comments & Details
                </h2>
                {comments.length > 0 && (
                  <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-blue-50 dark:bg-blue-950 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-800">
                    {comments.length} comment{comments.length > 1 ? "s" : ""}
                  </span>
                )}
              </div>
              <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5">
                Add comments, review cell contents, or suggest changes
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="text-zinc-400 hover:text-zinc-700 dark:hover:text-white transition text-xl leading-none cursor-pointer w-8 h-8 flex items-center justify-center rounded-lg hover:bg-slate-100 dark:hover:bg-zinc-800"
          >
            &times;
          </button>
        </div>

        {/* Modal Body */}
        <div className="px-6 py-5 space-y-5 overflow-y-auto flex-1">
          {/* Dynamic Row Summary Table */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-semibold text-zinc-700 dark:text-zinc-300 uppercase tracking-wider">
                Row Data
              </span>
              <span className="text-[11px] text-zinc-500">
                {rowCells.length} field{rowCells.length > 1 ? "s" : ""}
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 bg-slate-50 dark:bg-[#16161a] p-3.5 rounded-xl border border-zinc-200 dark:border-zinc-800/90 max-h-48 overflow-y-auto">
              {rowCells.map((cell, i) => (
                <div key={i} className="min-w-0 bg-white dark:bg-zinc-900/60 p-2 rounded-lg border border-zinc-200 dark:border-zinc-800/60 shadow-2xs">
                  <span className="text-[10px] text-zinc-500 dark:text-zinc-400 font-semibold uppercase block truncate">
                    {cell.name}
                  </span>
                  <span className="text-xs text-zinc-900 dark:text-zinc-200 font-medium break-all block mt-0.5">
                    {cell.value}
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* Comments & Discussions Thread */}
          <div className="pt-2 border-t border-zinc-200 dark:border-zinc-800">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-1.5">
                <span className="text-xs font-semibold text-zinc-800 dark:text-zinc-200 uppercase tracking-wider">
                  Comments & Discussion
                </span>
              </div>
              <span className="text-[11px] text-zinc-500">
                Visible to admins & team members
              </span>
            </div>

            {/* Comment List */}
            <div className="space-y-3 mb-4 max-h-60 overflow-y-auto pr-1">
              {comments.length === 0 ? (
                <div className="text-center py-6 px-4 rounded-xl border border-dashed border-zinc-200 dark:border-zinc-800 bg-slate-50/50 dark:bg-zinc-900/30">
                  <div className="w-8 h-8 rounded-full bg-slate-100 dark:bg-zinc-800 text-zinc-500 dark:text-zinc-400 flex items-center justify-center mx-auto mb-2">
                    💬
                  </div>
                  <p className="text-xs font-medium text-zinc-700 dark:text-zinc-300">No comments yet</p>
                  <p className="text-[11px] text-zinc-500 mt-0.5">
                    Leave a note, share updates, or suggest edits for this row.
                  </p>
                </div>
              ) : (
                comments.map((comment) => (
                  <div
                    key={comment.id}
                    className="p-3 bg-slate-50 dark:bg-[#16161a] border border-zinc-200 dark:border-zinc-800/80 rounded-xl flex items-start gap-3 text-xs group shadow-2xs"
                  >
                    <div className="w-7 h-7 rounded-lg bg-blue-100 dark:bg-blue-600/20 text-blue-700 dark:text-blue-300 font-bold flex items-center justify-center shrink-0 text-xs border border-blue-200 dark:border-blue-500/20">
                      {comment.authorName?.charAt(0)?.toUpperCase() || "U"}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-1.5">
                          <span className="font-semibold text-zinc-900 dark:text-white">
                            {comment.authorName || "User"}
                          </span>
                          <span className="text-[10px] px-1.5 py-0.2 rounded bg-slate-200 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-400 font-medium">
                            {comment.authorRole || "member"}
                          </span>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="text-[10px] text-zinc-500">
                            {formatTime(comment.createdAt)}
                          </span>
                          <button
                            type="button"
                            onClick={() => handleDeleteComment(comment.id)}
                            title="Delete comment"
                            className="text-zinc-400 hover:text-red-500 opacity-0 group-hover:opacity-100 transition cursor-pointer p-0.5"
                          >
                            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                            </svg>
                          </button>
                        </div>
                      </div>
                      <p className="text-zinc-700 dark:text-zinc-300 mt-1 text-xs whitespace-pre-wrap leading-relaxed">
                        {comment.text}
                      </p>
                    </div>
                  </div>
                ))
              )}
            </div>

            {/* Add Comment Input */}
            <div className="space-y-2">
              <textarea
                value={commentInput}
                onChange={(e) => setCommentInput(e.target.value)}
                onKeyDown={(e) => {
                  if ((e.ctrlKey || e.metaKey) && e.key === "Enter") {
                    e.preventDefault();
                    handleAddComment();
                  }
                }}
                rows={2}
                placeholder="Write a comment or suggest a change... (Ctrl+Enter to post)"
                className="w-full bg-slate-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700/80 rounded-xl p-3 text-xs text-zinc-900 dark:text-zinc-200 placeholder:text-zinc-400 dark:placeholder:text-zinc-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20 dark:focus:ring-blue-600 transition resize-none"
              />
              {error && <p className="text-xs text-red-600 dark:text-red-400">{error}</p>}
              <div className="flex items-center justify-between">
                <span className="text-[11px] text-zinc-500">
                  Press <kbd className="px-1 py-0.5 bg-slate-100 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded text-zinc-600 dark:text-zinc-400">Ctrl</kbd> + <kbd className="px-1 py-0.5 bg-slate-100 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded text-zinc-600 dark:text-zinc-400">Enter</kbd> to submit
                </span>
                <button
                  type="button"
                  onClick={handleAddComment}
                  disabled={saving || !commentInput.trim()}
                  className="flex items-center gap-1.5 px-4 py-2 bg-blue-600 hover:bg-blue-500 disabled:opacity-40 disabled:cursor-not-allowed text-white rounded-xl text-xs font-semibold transition cursor-pointer shadow-sm"
                >
                  {saving && <div className="w-3 h-3 border-2 border-white/30 border-t-white rounded-full animate-spin" />}
                  <span>Post Comment</span>
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="flex justify-end px-6 py-3 border-t border-zinc-200 dark:border-zinc-800 bg-slate-50 dark:bg-[#16161a]">
          <button
            onClick={onClose}
            className="px-4 py-1.5 text-xs font-medium text-zinc-700 dark:text-zinc-300 hover:text-zinc-900 dark:hover:text-white bg-white dark:bg-zinc-800 hover:bg-slate-100 dark:hover:bg-zinc-700 border border-zinc-200 dark:border-zinc-700/60 rounded-xl transition cursor-pointer shadow-2xs"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
}

