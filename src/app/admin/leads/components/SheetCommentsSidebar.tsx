"use client";
import { useState, useEffect, useRef, useCallback, useMemo } from "react";

export interface SheetCommentItem {
  id: string;
  fileId: string;
  tabId: string | null;
  userId: string;
  userName: string;
  userEmail: string;
  userRole: string;
  message: string;
  createdAt: string;
}

interface SheetCommentsSidebarProps {
  isOpen: boolean;
  onClose: () => void;
  fileId: string;
  tabId?: string;
  sheetName: string;
  currentUserId?: string;
  currentUserRole?: string;
}

export default function SheetCommentsSidebar({
  isOpen,
  onClose,
  fileId,
  tabId,
  sheetName,
  currentUserId,
  currentUserRole,
}: SheetCommentsSidebarProps) {
  const [comments, setComments] = useState<SheetCommentItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [inputMessage, setInputMessage] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [userMeta, setUserMeta] = useState<{ id?: string; name?: string; role?: string }>({});

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  // Fetch current user details if not supplied
  useEffect(() => {
    fetch("/api/admin/auth/me")
      .then((r) => r.json())
      .then((data) => {
        if (data.user) {
          setUserMeta({
            id: data.user.id,
            name: data.user.name,
            role: data.user.role,
          });
        }
      })
      .catch(() => {});
  }, []);

  // Determine active fileId with URL search params fallback
  const effectiveFileId = useMemo(() => {
    if (fileId && fileId.trim()) return fileId.trim();
    if (typeof window !== "undefined") {
      const sp = new URLSearchParams(window.location.search);
      const qFileId = sp.get("fileId");
      if (qFileId) return qFileId.trim();
    }
    return "";
  }, [fileId]);

  const scrollToBottom = useCallback((smooth = true) => {
    messagesEndRef.current?.scrollIntoView({ behavior: smooth ? "smooth" : "auto" });
  }, []);

  // Fetch comments
  const fetchComments = useCallback(async (isPolling = false) => {
    if (!effectiveFileId) return;
    if (!isPolling) setLoading(true);

    try {
      let url = `/api/admin/leads/comments?fileId=${encodeURIComponent(effectiveFileId)}`;
      if (tabId) url += `&tabId=${encodeURIComponent(tabId)}`;

      const res = await fetch(url);
      if (!res.ok) {
        const errJson = await res.json().catch(() => ({}));
        throw new Error(errJson.error || `Failed to fetch comments (${res.status})`);
      }
      const data = await res.json();
      if (data.comments) {
        setComments((prev) => {
          if (JSON.stringify(prev) !== JSON.stringify(data.comments)) {
            return data.comments;
          }
          return prev;
        });
      }
    } catch (err) {
      if (!isPolling) {
        setError(err instanceof Error ? err.message : "Error loading comments");
      }
    } finally {
      if (!isPolling) setLoading(false);
    }
  }, [effectiveFileId, tabId]);

  // Initial load and polling while sidebar is open
  useEffect(() => {
    if (isOpen && effectiveFileId) {
      fetchComments();
      const interval = setInterval(() => {
        fetchComments(true);
      }, 3500); // Live poll every 3.5s

      setTimeout(() => {
        inputRef.current?.focus();
        scrollToBottom(false);
      }, 150);

      return () => clearInterval(interval);
    }
  }, [isOpen, effectiveFileId, tabId, fetchComments, scrollToBottom]);

  // Scroll to bottom when new comments arrive
  useEffect(() => {
    if (isOpen) {
      scrollToBottom();
    }
  }, [comments.length, isOpen, scrollToBottom]);

  async function handleSend() {
    const text = inputMessage.trim();
    if (!text || sending || !effectiveFileId) return;

    setSending(true);
    setError(null);

    const activeUserId = currentUserId || userMeta.id || "you";
    const activeUserName = userMeta.name || "You";
    const activeRole = currentUserRole || userMeta.role || "member";

    // Optimistic comment
    const tempId = `temp-${Date.now()}`;
    const optimisticComment: SheetCommentItem = {
      id: tempId,
      fileId: effectiveFileId,
      tabId: tabId || null,
      userId: activeUserId,
      userName: activeUserName,
      userEmail: "",
      userRole: activeRole,
      message: text,
      createdAt: new Date().toISOString(),
    };

    setComments((prev) => [...prev, optimisticComment]);
    setInputMessage("");

    try {
      const res = await fetch("/api/admin/leads/comments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          fileId: effectiveFileId,
          tabId: tabId || null,
          message: text,
        }),
      });

      if (!res.ok) {
        const errJson = await res.json().catch(() => ({}));
        throw new Error(errJson.error || `Failed to post comment (${res.status})`);
      }

      const data = await res.json();
      if (data.comment) {
        setComments((prev) =>
          prev.map((c) => (c.id === tempId ? data.comment : c))
        );
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to send");
      // Revert optimistic comment on failure
      setComments((prev) => prev.filter((c) => c.id !== tempId));
    } finally {
      setSending(false);
      inputRef.current?.focus();
    }
  }

  async function handleDelete(id: string) {
    try {
      setComments((prev) => prev.filter((c) => c.id !== id));
      await fetch(`/api/admin/leads/comments?id=${encodeURIComponent(id)}`, {
        method: "DELETE",
      });
    } catch (err) {
      console.error("Failed to delete comment:", err);
      fetchComments();
    }
  }

  function formatTime(iso: string) {
    try {
      const d = new Date(iso);
      const now = new Date();
      const isToday = d.toDateString() === now.toDateString();
      if (isToday) {
        return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
      }
      return d.toLocaleDateString([], { month: "short", day: "numeric" }) + " " + d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
    } catch {
      return iso;
    }
  }

  const getAvatarColor = (name: string) => {
    const colors = [
      "bg-emerald-600 text-white",
      "bg-blue-600 text-white",
      "bg-purple-600 text-white",
      "bg-amber-600 text-white",
      "bg-rose-600 text-white",
      "bg-cyan-600 text-white",
    ];
    let hash = 0;
    for (let i = 0; i < name.length; i++) {
      hash = name.charCodeAt(i) + ((hash << 5) - hash);
    }
    return colors[Math.abs(hash) % colors.length];
  };

  if (!isOpen) return null;

  return (
    <>
      {/* Backdrop overlay for smaller screens */}
      <div
        className="fixed inset-0 bg-black/60 z-40 lg:hidden"
        onClick={onClose}
      />

      {/* Right Drawer */}
      <div className="fixed top-0 right-0 bottom-0 w-full sm:w-96 max-w-full bg-white dark:bg-[#111115] border-l border-zinc-200 dark:border-zinc-800 shadow-2xl z-50 flex flex-col animate-in slide-in-from-right duration-200">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3.5 border-b border-zinc-200 dark:border-zinc-800 bg-slate-50 dark:bg-[#16161a] shrink-0">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-8 h-8 rounded-xl bg-blue-600/10 dark:bg-blue-600/20 border border-blue-500/30 text-blue-600 dark:text-blue-400 flex items-center justify-center shrink-0">
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M8.625 12a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0H8.25m4.125 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0H12m4.125 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0h-.375M21 12c0 4.556-4.03 8.25-9 8.25a9.764 9.764 0 01-2.555-.337A5.972 5.972 0 015.41 20.97a.75.75 0 01-.817-.817 5.972 5.972 0 011.057-3.035C4.03 15.556 3 13.556 3 12c0-4.556 4.03-8.25 9-8.25s9 3.694 9 8.25z" />
              </svg>
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <h3 className="text-sm font-bold text-zinc-900 dark:text-white truncate">Sheet Discussion</h3>
                <span className="flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-500/10 text-emerald-600 dark:text-emerald-300 border border-emerald-500/30">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 dark:bg-emerald-400" />
                  Live
                </span>
              </div>
              <p className="text-[11px] text-zinc-500 dark:text-zinc-400 truncate">
                {sheetName || "Current Sheet"} • {comments.length} message{comments.length !== 1 ? "s" : ""}
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="w-8 h-8 rounded-lg text-zinc-500 hover:text-zinc-900 hover:bg-zinc-100 dark:text-zinc-400 dark:hover:text-white dark:hover:bg-zinc-800 flex items-center justify-center transition cursor-pointer"
            title="Close sidebar"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Message Feed Container */}
        <div className="flex-1 overflow-y-auto p-4 space-y-3.5 bg-zinc-50/50 dark:bg-transparent">
          {loading && comments.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-48 text-zinc-400 gap-2">
              <div className="w-5 h-5 border-2 border-zinc-400 border-t-blue-600 rounded-full animate-spin" />
              <span className="text-xs">Loading discussion...</span>
            </div>
          ) : comments.length === 0 ? (
            <div className="text-center py-12 px-4 rounded-2xl border border-dashed border-zinc-200 dark:border-zinc-800 bg-zinc-100/50 dark:bg-zinc-900/20">
              <div className="w-10 h-10 rounded-2xl bg-zinc-200 dark:bg-zinc-800 text-zinc-500 flex items-center justify-center mx-auto mb-3 text-lg">
                💬
              </div>
              <h4 className="text-xs font-bold text-zinc-800 dark:text-zinc-200">No comments yet</h4>
              <p className="text-[11px] text-zinc-500 mt-1 leading-relaxed">
                Team members and viewers can share suggestions, updates, or discuss sheet changes in real time.
              </p>
            </div>
          ) : (
            comments.map((c) => {
              const isMe = c.userId === currentUserId || c.userName === "You";
              const canDelete = currentUserRole === "admin" || c.userId === currentUserId;

              return (
                <div
                  key={c.id}
                  className={`flex items-start gap-2.5 group animate-in fade-in duration-150 ${
                    isMe ? "flex-row-reverse" : "flex-row"
                  }`}
                >
                  {/* User Avatar */}
                  <div
                    className={`w-7 h-7 rounded-xl flex items-center justify-center text-[11px] font-bold shrink-0 shadow-sm ${getAvatarColor(
                      c.userName || "U"
                    )}`}
                  >
                    {(c.userName || "U").charAt(0).toUpperCase()}
                  </div>

                  {/* Message Bubble & Meta */}
                  <div className={`max-w-[78%] flex flex-col ${isMe ? "items-end" : "items-start"}`}>
                    <div className="flex items-center gap-1.5 mb-1 px-1">
                      <span className="text-[11px] font-semibold text-zinc-700 dark:text-zinc-300">
                        {isMe ? "You" : c.userName}
                      </span>
                      {c.userRole && (
                        <span className="text-[9px] font-bold px-1.5 py-0.2 rounded uppercase tracking-wider bg-zinc-200 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400">
                          {c.userRole}
                        </span>
                      )}
                      <span className="text-[10px] text-zinc-400 ml-0.5">
                        {formatTime(c.createdAt)}
                      </span>
                    </div>

                    <div
                      className={`relative px-3.5 py-2.5 rounded-2xl text-xs whitespace-pre-wrap leading-relaxed shadow-sm break-words ${
                        isMe
                          ? "bg-blue-600 text-white rounded-tr-sm"
                          : "bg-white dark:bg-[#18181d] text-zinc-900 dark:text-zinc-200 border border-zinc-200 dark:border-zinc-800 rounded-tl-sm"
                      }`}
                    >
                      {c.message}

                      {/* Delete button */}
                      {canDelete && (
                        <button
                          type="button"
                          onClick={() => handleDelete(c.id)}
                          title="Delete message"
                          className="absolute -top-1.5 -right-1.5 w-4 h-4 rounded-full bg-zinc-100 dark:bg-zinc-800 border border-zinc-300 dark:border-zinc-700 text-zinc-500 hover:text-red-500 hover:bg-zinc-200 flex items-center justify-center opacity-0 group-hover:opacity-100 transition cursor-pointer"
                        >
                          &times;
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              );
            })
          )}
          <div ref={messagesEndRef} />
        </div>

        {/* Input Footer */}
        <div className="p-3.5 border-t border-zinc-200 dark:border-zinc-800 bg-slate-50 dark:bg-[#16161a] shrink-0">
          {error && <p className="text-xs text-red-500 mb-2">{error}</p>}
          <div className="relative flex items-end gap-2 bg-white dark:bg-zinc-900/90 border border-zinc-300 dark:border-zinc-700/80 rounded-2xl p-2 focus-within:border-blue-500 transition shadow-sm">
            <textarea
              ref={inputRef}
              value={inputMessage}
              onChange={(e) => setInputMessage(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  handleSend();
                }
              }}
              rows={2}
              placeholder="Write a comment or suggest a change..."
              className="flex-1 bg-transparent text-xs text-zinc-900 dark:text-zinc-200 placeholder:text-zinc-400 dark:placeholder:text-zinc-500 focus:outline-none resize-none px-1 py-0.5 max-h-24 leading-relaxed"
            />
            <button
              type="button"
              onClick={handleSend}
              disabled={sending || !inputMessage.trim()}
              className="w-8 h-8 rounded-xl bg-blue-600 hover:bg-blue-500 disabled:opacity-30 text-white flex items-center justify-center transition shrink-0 cursor-pointer shadow-md"
              title="Send comment (Enter)"
            >
              {sending ? (
                <div className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              ) : (
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 12L3.269 3.126A59.768 59.768 0 0121.485 12 59.77 59.77 0 013.27 20.876L5.999 12zm0 0h7.5" />
                </svg>
              )}
            </button>
          </div>
          <div className="flex items-center justify-between text-[10px] text-zinc-500 mt-1.5 px-1">
            <span>Press <kbd className="px-1 py-0.2 bg-zinc-200 dark:bg-zinc-800 rounded text-zinc-700 dark:text-zinc-400">Enter</kbd> to send</span>
            <span><kbd className="px-1 py-0.2 bg-zinc-200 dark:bg-zinc-800 rounded text-zinc-700 dark:text-zinc-400">Shift + Enter</kbd> for new line</span>
          </div>
        </div>
      </div>
    </>
  );
}
