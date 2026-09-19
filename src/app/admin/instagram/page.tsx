"use client";

import { useState, useEffect, useRef, Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import DropdownSelect from "@/components/DropdownSelect";

interface InstagramAccountData {
  id: string;
  instagramId: string;
  username: string;
  name?: string | null;
  profilePictureUrl?: string | null;
  accountType?: string | null;
  biography?: string | null;
  website?: string | null;
  pageName?: string | null;
  followersCount?: number | null;
  followsCount?: number | null;
  mediaCount?: number | null;
  hasToken?: boolean;
}

interface InstagramPost {
  id: string;
  caption?: string;
  media_type: string;
  media_url?: string;
  thumbnail_url?: string;
  permalink?: string;
  timestamp?: string;
  like_count?: number;
  comments_count?: number;
  children?: { data: { id: string; media_type: string; media_url: string }[] };
}

interface LocalPostLog {
  id: string;
  mediaId?: string | null;
  caption?: string | null;
  mediaUrl: string;
  mediaType: string;
  permalink?: string | null;
  status: string;
  scheduledFor?: string | null;
  publishedAt?: string | null;
  createdAt: string;
}

interface InstagramComment {
  id: string;
  text: string;
  timestamp: string;
  username?: string;
  like_count?: number;
  hidden?: boolean;
  replies?: {
    data: {
      id: string;
      text: string;
      timestamp: string;
      username?: string;
      like_count?: number;
      hidden?: boolean;
    }[];
  };
}

export default function InstagramPage() {
  return (
    <Suspense
      fallback={
        <div className="flex-1 flex flex-col items-center justify-center min-h-[60vh]">
          <div className="w-8 h-8 border-2 border-zinc-500 border-t-zinc-200 rounded-full animate-spin mb-3" />
          <p className="text-xs text-zinc-500 font-medium">Loading Instagram Manager...</p>
        </div>
      }
    >
      <InstagramContent />
    </Suspense>
  );
}

function InstagramContent() {
  const searchParams = useSearchParams();
  const router = useRouter();

  const [accounts, setAccounts] = useState<InstagramAccountData[]>([]);
  const [selectedAccountId, setSelectedAccountId] = useState<string>("");
  const [currentAccount, setCurrentAccount] = useState<InstagramAccountData | null>(null);
  const [posts, setPosts] = useState<InstagramPost[]>([]);
  const [scheduledPosts, setScheduledPosts] = useState<LocalPostLog[]>([]);
  const [localLogs, setLocalLogs] = useState<LocalPostLog[]>([]);
  const [loadingAccounts, setLoadingAccounts] = useState(true);
  const [loadingPosts, setLoadingPosts] = useState(false);
  const [syncingStats, setSyncingStats] = useState(false);

  // Tabs & Filters
  const [activeTab, setActiveTab] = useState<"feed" | "scheduled" | "analytics">("feed");
  const [filterType, setFilterType] = useState<string>("ALL");
  const [searchQuery, setSearchQuery] = useState("");

  // Create Post Modal State
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [postMediaType, setPostMediaType] = useState<"IMAGE" | "VIDEO" | "CAROUSEL">("IMAGE");
  const [carouselUrls, setCarouselUrls] = useState<string[]>([]);
  const [mediaUrlInput, setMediaUrlInput] = useState("");
  const [captionInput, setCaptionInput] = useState("");
  const [isScheduleMode, setIsScheduleMode] = useState(false);
  const [scheduleDateTime, setScheduleDateTime] = useState("");
  const [uploadingMedia, setUploadingMedia] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [dragActive, setDragActive] = useState(false);
  const [previewSlideIdx, setPreviewSlideIdx] = useState(0);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Detail & Comments Modal
  const [viewingPost, setViewingPost] = useState<InstagramPost | null>(null);
  const [viewingScheduledPost, setViewingScheduledPost] = useState<LocalPostLog | null>(null);
  const [postComments, setPostComments] = useState<InstagramComment[]>([]);
  const [loadingComments, setLoadingComments] = useState(false);
  const [newCommentText, setNewCommentText] = useState("");
  const [replyToCommentId, setReplyToCommentId] = useState<string | null>(null);
  const [submittingComment, setSubmittingComment] = useState(false);
  const [publishingScheduledId, setPublishingScheduledId] = useState<string | null>(null);

  // Toast
  const [toast, setToast] = useState<{ type: "success" | "error" | "info"; message: string } | null>(null);

  // Custom Confirmation Modal for Deletion / Disconnect (No native window.confirm/alert)
  const [deleteConfirmState, setDeleteConfirmState] = useState<{
    isOpen: boolean;
    id: string;
    title: string;
    description: string;
    isDeleting?: boolean;
    actionType?: "post" | "disconnect";
    accountUsername?: string;
    isLive?: boolean;
    permalink?: string;
  }>({
    isOpen: false,
    id: "",
    title: "",
    description: "",
  });

  // Handle URL params after OAuth callback
  useEffect(() => {
    const status = searchParams.get("status");
    const error = searchParams.get("error");
    const username = searchParams.get("username");

    if (status === "connected") {
      setToast({
        type: "success",
        message: `Connected Instagram account @${username || "user"}!`,
      });
      router.replace("/admin/instagram");
    } else if (error) {
      setToast({
        type: "error",
        message: decodeURIComponent(error),
      });
      router.replace("/admin/instagram");
    }
  }, [searchParams, router]);

  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(() => setToast(null), 4500);
    return () => clearTimeout(timer);
  }, [toast]);

  // Fetch Accounts
  const fetchAccounts = async (silent = false) => {
    if (!silent) setLoadingAccounts(true);
    try {
      const res = await fetch("/api/admin/instagram/accounts", { cache: "no-store" });
      const data = await res.json();
      if (res.ok) {
        setAccounts(data.accounts || []);
        if (data.accounts && data.accounts.length > 0) {
          const matched = selectedAccountId
            ? data.accounts.find((a: InstagramAccountData) => a.id === selectedAccountId)
            : data.accounts[0];
          const chosen = matched || data.accounts[0];
          setSelectedAccountId(chosen.id);
          setCurrentAccount(chosen);
        } else {
          setCurrentAccount(null);
        }
      } else {
        if (!silent) setToast({ type: "error", message: data.error || "Failed to load accounts" });
      }
    } catch {
      if (!silent) setToast({ type: "error", message: "Failed to load accounts" });
    } finally {
      if (!silent) setLoadingAccounts(false);
    }
  };

  useEffect(() => {
    fetchAccounts();
  }, []);

  // Fetch Posts for selected account
  const fetchPosts = async (accId?: string, silent = false) => {
    const targetId = accId || selectedAccountId;
    if (!silent) setLoadingPosts(true);
    try {
      const url = targetId
        ? `/api/admin/instagram/posts?accountId=${targetId}`
        : "/api/admin/instagram/posts";
      const res = await fetch(url, { cache: "no-store" });
      const data = await res.json();

      if (res.ok) {
        setPosts(data.posts || []);
        setScheduledPosts(data.scheduledPosts || []);
        setLocalLogs(data.localLogs || []);
        if (data.account) {
          setCurrentAccount(data.account);
        }
      } else {
        if (!silent) setToast({ type: "error", message: data.error || "Failed to load posts" });
      }
    } catch {
      if (!silent) setToast({ type: "error", message: "Network error loading posts" });
    } finally {
      if (!silent) setLoadingPosts(false);
    }
  };

  useEffect(() => {
    if (selectedAccountId) {
      const acc = accounts.find((a) => a.id === selectedAccountId);
      if (acc) setCurrentAccount(acc);
      fetchPosts(selectedAccountId);
    }
  }, [selectedAccountId]);

  // Auto-sync live feed & stats in background (Buffer-like real-time updates)
  useEffect(() => {
    if (!selectedAccountId) return;

    const handleFocus = () => {
      fetchPosts(selectedAccountId, true);
    };

    window.addEventListener("focus", handleFocus);
    const interval = setInterval(() => {
      fetchPosts(selectedAccountId, true);
    }, 45000); // Poll every 45s

    return () => {
      window.removeEventListener("focus", handleFocus);
      clearInterval(interval);
    };
  }, [selectedAccountId]);

  // Refresh Profile & Live Stats manually
  const handleRefreshLiveStats = async () => {
    setSyncingStats(true);
    try {
      await Promise.all([fetchAccounts(true), fetchPosts(selectedAccountId, true)]);
      setToast({ type: "success", message: "Live profile and feed synced with Instagram!" });
    } catch {
      setToast({ type: "error", message: "Failed to sync live stats" });
    } finally {
      setSyncingStats(false);
    }
  };

  // Connect Instagram via OAuth
  const handleConnectInstagram = async (mode: "direct" | "meta" = "direct") => {
    try {
      const res = await fetch(`/api/admin/instagram/auth/url?mode=${mode}`);
      const data = await res.json();

      if (!res.ok || !data.authUrl) {
        setToast({
          type: "error",
          message: data.error || "Could not generate authorization link",
        });
        return;
      }

      window.location.href = data.authUrl;
    } catch {
      setToast({ type: "error", message: "Failed to start Instagram authorization flow" });
    }
  };

  // Disconnect Account (Triggers website popup modal)
  const handleDisconnect = async (id: string, username: string) => {
    setDeleteConfirmState({
      isOpen: true,
      id,
      title: "Disconnect Instagram Account",
      description: `Are you sure you want to disconnect @${username}? You can reconnect this account at any time.`,
      actionType: "disconnect",
      accountUsername: username,
    });
  };

  // Delete / Cancel Scheduled or Logged or Live Post (Triggers website popup modal)
  const handleDeletePost = async (id: string, isLive: boolean = false, permalink?: string) => {
    const foundPost = posts.find((p) => p.id === id) || scheduledPosts.find((p) => p.id === id || p.mediaId === id);
    const targetPermalink = permalink || (foundPost as any)?.permalink;

    setDeleteConfirmState({
      isOpen: true,
      id,
      title: isLive ? "Delete Instagram Post" : "Cancel Scheduled Post",
      description: isLive
        ? "Are you sure you want to remove this post? Due to Meta's security restrictions, third-party apps cannot delete published posts directly from Instagram servers. You can open it on Instagram to delete it permanently, or remove it from your workspace dashboard."
        : "Are you sure you want to cancel and delete this scheduled post? It will be permanently removed from your queue and will NOT be posted to Instagram.",
      actionType: "post",
      isLive,
      permalink: targetPermalink,
    });
  };

  // Alias for scheduled post deletion
  const handleDeletePostLog = handleDeletePost;

  // Confirm delete or disconnect action from website popup modal
  const handleConfirmAction = async () => {
    if (!deleteConfirmState.id) return;
    setDeleteConfirmState((prev) => ({ ...prev, isDeleting: true }));
    try {
      if (deleteConfirmState.actionType === "disconnect") {
        const res = await fetch(`/api/admin/instagram/accounts?id=${deleteConfirmState.id}`, {
          method: "DELETE",
        });
        const data = await res.json();
        if (res.ok) {
          setToast({ type: "success", message: `Disconnected @${deleteConfirmState.accountUsername || "account"}` });
          setDeleteConfirmState({ isOpen: false, id: "", title: "", description: "" });
          fetchAccounts();
        } else {
          setToast({ type: "error", message: data.error || "Failed to disconnect account" });
          setDeleteConfirmState((prev) => ({ ...prev, isDeleting: false }));
        }
        return;
      }

      // Default: post / history log / live feed post deletion
      const res = await fetch(`/api/admin/instagram/posts?id=${deleteConfirmState.id}&accountId=${selectedAccountId || currentAccount?.id || ""}`, {
        method: "DELETE",
      });
      const data = await res.json();
      if (res.ok) {
        if (data.metaRestricted) {
          setToast({
            type: "info",
            message: "Removed from dashboard. (Note: To delete from Instagram, delete directly in the Instagram app)",
          });
        } else {
          setToast({ type: "success", message: data.message || "Post deleted successfully" });
        }
        setDeleteConfirmState({ isOpen: false, id: "", title: "", description: "" });
        if (viewingPost?.id === deleteConfirmState.id) setViewingPost(null);
        if (viewingScheduledPost?.id === deleteConfirmState.id) setViewingScheduledPost(null);
        setPosts((prev) => prev.filter((p) => p.id !== deleteConfirmState.id));
        setScheduledPosts((prev) => prev.filter((p) => p.id !== deleteConfirmState.id && p.mediaId !== deleteConfirmState.id));
        fetchPosts(selectedAccountId, true);
      } else {
        setToast({ type: "error", message: data.error || "Failed to delete post" });
        setDeleteConfirmState((prev) => ({ ...prev, isDeleting: false }));
      }
    } catch {
      setToast({ type: "error", message: "Network error while deleting" });
      setDeleteConfirmState((prev) => ({ ...prev, isDeleting: false }));
    }
  };

  // Publish a scheduled post right now
  const handlePublishScheduledNow = async (postId: string) => {
    setPublishingScheduledId(postId);
    try {
      const res = await fetch("/api/admin/instagram/posts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          accountId: selectedAccountId,
          action: "publish_now",
          postId,
        }),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setToast({ type: "success", message: "Scheduled post published to Instagram now!" });
        fetchPosts(selectedAccountId, true);
        if (viewingScheduledPost?.id === postId) setViewingScheduledPost(null);
      } else {
        setToast({ type: "error", message: data.error || "Failed to publish scheduled post" });
      }
    } catch {
      setToast({ type: "error", message: "Network error while publishing post" });
    } finally {
      setPublishingScheduledId(null);
    }
  };

  // Process File Upload
  const processUploadedFiles = async (files: FileList | File[]) => {
    const fileArray = Array.from(files);
    if (fileArray.length === 0) return;

    setUploadingMedia(true);
    try {
      const uploadedUrls: string[] = [];
      for (const file of fileArray) {
        const formData = new FormData();
        formData.append("file", file);

        const res = await fetch("/api/admin/instagram/upload", {
          method: "POST",
          body: formData,
        });
        const data = await res.json();
        if (res.ok && data.url) {
          uploadedUrls.push(data.url);
        }
      }

      if (uploadedUrls.length > 1) {
        setPostMediaType("CAROUSEL");
        setCarouselUrls((prev) => [...prev, ...uploadedUrls]);
        setMediaUrlInput(uploadedUrls[0]);
        setToast({ type: "success", message: `Uploaded ${uploadedUrls.length} files for carousel!` });
      } else if (uploadedUrls.length === 1) {
        const singleUrl = uploadedUrls[0];
        const isVideo = fileArray[0].type.startsWith("video/");
        if (postMediaType === "CAROUSEL") {
          setCarouselUrls((prev) => [...prev, singleUrl]);
        } else {
          setPostMediaType(isVideo ? "VIDEO" : "IMAGE");
          setMediaUrlInput(singleUrl);
        }
        setToast({ type: "success", message: "Media uploaded successfully!" });
      }
    } catch {
      setToast({ type: "error", message: "Error uploading media file(s)" });
    } finally {
      setUploadingMedia(false);
    }
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) processUploadedFiles(e.target.files);
  };

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      processUploadedFiles(e.dataTransfer.files);
    }
  };

  // Handle Submit (Publish Now OR Schedule)
  const handleSubmitPost = async (e: React.FormEvent) => {
    e.preventDefault();
    const effectiveUrls =
      postMediaType === "CAROUSEL"
        ? carouselUrls.filter(Boolean)
        : mediaUrlInput.trim()
        ? [mediaUrlInput.trim()]
        : [];

    if (effectiveUrls.length === 0) {
      setToast({ type: "error", message: "Please upload an image/video or enter a valid URL" });
      return;
    }

    if (isScheduleMode && !scheduleDateTime) {
      setToast({ type: "error", message: "Please select a date and time to schedule the post" });
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch("/api/admin/instagram/posts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          accountId: selectedAccountId,
          mediaUrl: effectiveUrls[0],
          mediaUrls: effectiveUrls,
          caption: captionInput.trim(),
          mediaType: postMediaType,
          isScheduled: isScheduleMode,
          scheduledFor: isScheduleMode ? new Date(scheduleDateTime).toISOString() : null,
        }),
      });

      const data = await res.json();

      if (res.ok && data.success) {
        setToast({
          type: "success",
          message: isScheduleMode
            ? `Post scheduled for ${new Date(scheduleDateTime).toLocaleString()}`
            : "Post published to Instagram successfully!",
        });
        setShowCreateModal(false);
        setMediaUrlInput("");
        setCarouselUrls([]);
        setCaptionInput("");
        setIsScheduleMode(false);
        setScheduleDateTime("");
        fetchPosts(selectedAccountId, true);
      } else {
        setToast({
          type: "error",
          message: data.error || "Failed to process post",
        });
      }
    } catch {
      setToast({ type: "error", message: "Network error processing post" });
    } finally {
      setSubmitting(false);
    }
  };

  // Fetch comments when viewing a post
  const fetchComments = async (mediaId: string, silent = false) => {
    if (!silent) setLoadingComments(true);
    try {
      const res = await fetch(
        `/api/admin/instagram/comments?mediaId=${mediaId}&accountId=${selectedAccountId}`,
        { cache: "no-store" }
      );
      const data = await res.json();
      if (res.ok && Array.isArray(data.comments)) {
        setPostComments(data.comments);
      }
    } catch {
      if (!silent) setPostComments([]);
    } finally {
      if (!silent) setLoadingComments(false);
    }
  };

  // Live poll comments every 8s while post modal is open
  useEffect(() => {
    if (!viewingPost?.id) return;
    const interval = setInterval(() => {
      fetchComments(viewingPost.id, true);
    }, 8000);
    return () => clearInterval(interval);
  }, [viewingPost?.id, selectedAccountId]);

  const handleOpenPostDetail = (post: InstagramPost) => {
    setViewingPost(post);
    setPostComments([]);
    setReplyToCommentId(null);
    setNewCommentText("");
    fetchComments(post.id);
  };

  // Submit comment / reply
  const handlePostComment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCommentText.trim() || !viewingPost) return;

    setSubmittingComment(true);
    try {
      const res = await fetch("/api/admin/instagram/comments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          accountId: selectedAccountId,
          mediaId: viewingPost.id,
          commentId: replyToCommentId || undefined,
          message: newCommentText.trim(),
        }),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setToast({ type: "success", message: "Comment posted to Instagram!" });
        setNewCommentText("");
        setReplyToCommentId(null);
        fetchComments(viewingPost.id);
      } else {
        setToast({ type: "error", message: data.error || "Failed to post comment" });
      }
    } catch {
      setToast({ type: "error", message: "Failed to post comment" });
    } finally {
      setSubmittingComment(false);
    }
  };

  // Filter options
  const filterOptions = [
    { label: "All Types", value: "ALL" },
    { label: "Photos", value: "IMAGE" },
    { label: "Videos / Reels", value: "VIDEO" },
    { label: "Carousels", value: "CAROUSEL" },
  ];

  const accountOptions = accounts.map((a) => ({
    label: `@${a.username}`,
    value: a.id,
  }));

  const filteredPosts = posts.filter((p) => {
    if (filterType !== "ALL") {
      if (filterType === "CAROUSEL" && p.media_type !== "CAROUSEL_ALBUM") return false;
      if (filterType !== "CAROUSEL" && p.media_type !== filterType) return false;
    }
    if (searchQuery.trim()) {
      return p.caption?.toLowerCase().includes(searchQuery.toLowerCase());
    }
    return true;
  });

  const appendHashtag = (tag: string) => {
    setCaptionInput((prev) => (prev ? `${prev} ${tag}` : tag));
  };

  return (
    <div className="w-full p-4 sm:p-6 lg:p-8 space-y-6">
      {/* Toast Notification */}
      {toast && (
        <div
          className={`fixed bottom-6 right-6 z-[100] px-4 py-3 rounded-xl text-sm font-semibold shadow-2xl flex items-center gap-2.5 animate-in slide-in-from-bottom-3 fade-in duration-200 max-w-md ${
            toast.type === "success"
              ? "bg-emerald-600 text-white border border-emerald-500"
              : toast.type === "error"
              ? "bg-red-600 text-white border border-red-500"
              : "bg-zinc-800 text-white border border-zinc-700"
          }`}
        >
          <span>{toast.message}</span>
          <button
            onClick={() => setToast(null)}
            className="ml-auto text-white/80 hover:text-white text-base leading-none"
          >
            &times;
          </button>
        </div>
      )}

      {/* Top Header Bar */}
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 pb-2 border-b border-zinc-200 dark:border-zinc-800">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-amber-500 via-rose-500 to-purple-600 flex items-center justify-center text-white shadow-md shadow-rose-500/20">
              <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838c-3.403 0-6.162 2.759-6.162 6.162s2.759 6.163 6.162 6.163 6.162-2.759 6.162-6.163c0-3.403-2.759-6.162-6.162-6.162zm0 10.162c-2.209 0-4-1.79-4-4 0-2.209 1.791-4 4-4s4 1.791 4 4c0 2.21-1.791 4-4 4zm6.406-11.845c-.796 0-1.441.645-1.441 1.44s.645 1.44 1.441 1.44c.795 0 1.439-.645 1.439-1.44s-.644-1.44-1.439-1.44z" />
              </svg>
            </div>
            <div>
              <h1 className="text-2xl font-bold text-zinc-900 dark:text-white tracking-tight">
                Instagram Manager
              </h1>
              <p className="text-sm text-zinc-500 dark:text-zinc-400 mt-0.5">
                Publish posts & reels, schedule content, manage live comments, and track insights
              </p>
            </div>
          </div>
        </div>

        {/* Global Actions */}
        <div className="flex items-center flex-wrap gap-2.5 w-full md:w-auto justify-end">
          {accounts.length > 1 && (
            <div className="w-48">
              <DropdownSelect
                options={accountOptions}
                value={selectedAccountId}
                onChange={setSelectedAccountId}
                placeholder="Select account"
              />
            </div>
          )}

          {currentAccount && (
            <>
              <button
                onClick={handleRefreshLiveStats}
                disabled={syncingStats}
                className="px-3.5 py-2 bg-white dark:bg-zinc-900 hover:bg-slate-50 dark:hover:bg-zinc-800 text-zinc-700 dark:text-zinc-300 border border-zinc-200 dark:border-zinc-800 rounded-xl text-xs font-semibold transition-colors flex items-center gap-1.5 cursor-pointer disabled:opacity-60 shadow-sm"
                title="Sync followers, following, and fresh feed"
              >
                <svg
                  className={`w-3.5 h-3.5 ${syncingStats ? "animate-spin text-blue-400" : ""}`}
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth={2}
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
                  />
                </svg>
                <span>{syncingStats ? "Syncing..." : "Sync Live"}</span>
              </button>

              <button
                onClick={() => setShowCreateModal(true)}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-xs font-bold transition flex items-center gap-1.5 cursor-pointer shadow-sm"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
                </svg>
                <span>Create Post</span>
              </button>
            </>
          )}

          <button
            onClick={() => handleConnectInstagram("direct")}
            className="px-3.5 py-2 bg-white dark:bg-zinc-900 hover:bg-slate-50 dark:hover:bg-zinc-800 border border-zinc-200 dark:border-zinc-800 text-zinc-700 dark:text-zinc-300 rounded-xl text-xs font-semibold transition flex items-center gap-1.5 cursor-pointer shadow-sm"
          >
            <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 24 24">
              <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073z" />
            </svg>
            <span>{currentAccount ? "Add Another Account" : "Connect Instagram"}</span>
          </button>
        </div>
      </div>

      {/* Main Container */}
      {loadingAccounts ? (
        <div className="flex flex-col items-center justify-center min-h-[40vh]">
          <div className="w-7 h-7 border-2 border-zinc-500 border-t-zinc-200 rounded-full animate-spin mb-3" />
          <p className="text-xs text-zinc-500 font-medium">Loading Instagram accounts...</p>
        </div>
      ) : !currentAccount ? (
        /* Empty State: No Account Connected */
        <div className="p-12 text-center bg-white dark:bg-[#111114] border border-zinc-200 dark:border-zinc-800 rounded-2xl max-w-xl mx-auto shadow-xs space-y-5">
          <div className="w-14 h-14 rounded-full bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 flex items-center justify-center mx-auto border border-zinc-200 dark:border-zinc-700">
            <svg className="w-7 h-7" fill="currentColor" viewBox="0 0 24 24">
              <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838c-3.403 0-6.162 2.759-6.162 6.162s2.759 6.163 6.162 6.163 6.162-2.759 6.162-6.163c0-3.403-2.759-6.162-6.162-6.162zm0 10.162c-2.209 0-4-1.79-4-4 0-2.209 1.791-4 4-4s4 1.791 4 4c0 2.21-1.791 4-4 4zm6.406-11.845c-.796 0-1.441.645-1.441 1.44s.645 1.44 1.441 1.44c.795 0 1.439-.645 1.439-1.44s-.644-1.44-1.439-1.44z" />
            </svg>
          </div>
          <div>
            <h3 className="text-base font-bold text-zinc-900 dark:text-white">
              Connect Your Instagram Account
            </h3>
            <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-1 max-w-md mx-auto">
              Link your Instagram profile to schedule posts, publish single or carousel media, reply to comments, and analyze insights.
            </p>
          </div>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-3 pt-2">
            <button
              onClick={() => handleConnectInstagram("direct")}
              className="w-full sm:w-auto px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-xs font-bold transition-all duration-150 flex items-center justify-center gap-2 cursor-pointer shadow-xs active:scale-97"
            >
              <span>Connect via Instagram</span>
            </button>
            <button
              onClick={() => handleConnectInstagram("meta")}
              className="w-full sm:w-auto px-4 py-2 bg-white dark:bg-[#111114] hover:bg-zinc-100 dark:hover:bg-zinc-800 border border-zinc-200 dark:border-zinc-800 text-zinc-700 dark:text-zinc-200 rounded-xl text-xs font-semibold transition-all duration-150 flex items-center justify-center gap-2 cursor-pointer shadow-xs active:scale-97"
            >
              <span>Connect via Facebook Page</span>
            </button>
          </div>
        </div>
      ) : (
        /* Connected Account Workspace */
        <div className="space-y-6">
          {/* Account Profile Header Card */}
          <div className="p-5 md:p-6 bg-white dark:bg-[#111114] border border-zinc-200 dark:border-zinc-800 rounded-2xl shadow-xs flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
            <div className="flex items-center gap-4">
              <div className="relative">
                <div className="w-16 h-16 rounded-full p-[2px] bg-zinc-200 dark:bg-zinc-700 border border-zinc-300 dark:border-zinc-600">
                  <div className="w-full h-full rounded-full overflow-hidden bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center">
                    {currentAccount.profilePictureUrl ? (
                      <img
                        src={currentAccount.profilePictureUrl}
                        alt={currentAccount.username}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <span className="text-xl font-bold text-zinc-800 dark:text-zinc-200 uppercase">
                        {currentAccount.username.charAt(0)}
                      </span>
                    )}
                  </div>
                </div>
              </div>

              <div>
                <div className="flex items-center gap-2">
                  <h2 className="text-base font-bold text-zinc-900 dark:text-white">
                    {currentAccount.name || currentAccount.username}
                  </h2>
                  <span className="px-2 py-0.5 text-[10px] font-semibold bg-blue-50 dark:bg-blue-950/40 text-blue-600 dark:text-blue-400 border border-blue-200 dark:border-blue-800/60 rounded-full">
                    {currentAccount.accountType || "Connected"}
                  </span>
                </div>
                <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5">
                  @{currentAccount.username}
                </p>

                {currentAccount.biography && (
                  <p className="text-xs text-zinc-600 dark:text-zinc-300 mt-1 line-clamp-2 max-w-md">
                    {currentAccount.biography}
                  </p>
                )}

                {/* Followers, Following, Posts Count Metrics */}
                <div className="flex items-center flex-wrap gap-4 mt-2.5 text-xs">
                  <span className="text-zinc-600 dark:text-zinc-400">
                    <strong className="text-zinc-900 dark:text-white font-bold">
                      {Math.max(currentAccount.mediaCount ?? 0, posts.length)}
                    </strong>{" "}
                    posts
                  </span>
                  <span className="text-zinc-600 dark:text-zinc-400">
                    <strong className="text-zinc-900 dark:text-white font-bold">
                      {currentAccount.followersCount !== null && currentAccount.followersCount !== undefined
                        ? currentAccount.followersCount.toLocaleString()
                        : "—"}
                    </strong>{" "}
                    followers
                  </span>
                  <span className="text-zinc-600 dark:text-zinc-400">
                    <strong className="text-zinc-900 dark:text-white font-bold">
                      {currentAccount.followsCount !== null && currentAccount.followsCount !== undefined
                        ? currentAccount.followsCount.toLocaleString()
                        : "—"}
                    </strong>{" "}
                    following
                  </span>
                  <span className="text-zinc-600 dark:text-zinc-400">
                    <strong className="text-zinc-900 dark:text-white font-bold">
                      {scheduledPosts.length}
                    </strong>{" "}
                    scheduled
                  </span>
                </div>
              </div>
            </div>

            {/* Profile Action Buttons */}
            <div className="flex items-center gap-2 w-full md:w-auto justify-end">
              <a
                href={`https://instagram.com/${currentAccount.username}`}
                target="_blank"
                rel="noreferrer"
                className="px-3.5 py-2 bg-white dark:bg-[#111114] hover:bg-zinc-100 dark:hover:bg-zinc-800 border border-zinc-200 dark:border-zinc-800 hover:border-zinc-300 dark:hover:border-zinc-700 rounded-xl text-xs font-semibold text-zinc-700 dark:text-zinc-200 transition-all duration-150 flex items-center gap-1.5 shadow-xs active:scale-97 cursor-pointer"
              >
                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                </svg>
                <span>Open Profile</span>
              </a>

              <button
                onClick={() => handleDisconnect(currentAccount.id, currentAccount.username)}
                className="px-3.5 py-2 bg-red-50 hover:bg-red-100 dark:bg-red-950/40 dark:hover:bg-red-900/50 border border-red-200 dark:border-red-900 rounded-xl text-xs font-semibold text-red-600 dark:text-red-400 transition-all duration-150 cursor-pointer active:scale-97 shadow-xs"
              >
                Disconnect
              </button>
            </div>
          </div>

          {/* Navigation Tabs & Search */}
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
            {/* Tabs */}
            <div className="flex items-center gap-1 bg-zinc-100 dark:bg-zinc-900 p-1 rounded-xl border border-zinc-200 dark:border-zinc-800 w-full sm:w-auto">
              <button
                onClick={() => setActiveTab("feed")}
                className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold transition cursor-pointer ${
                  activeTab === "feed"
                    ? "bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white shadow-sm"
                    : "text-zinc-500 hover:text-zinc-900 dark:hover:text-white"
                }`}
              >
                Feed ({posts.length})
              </button>

              <button
                onClick={() => setActiveTab("scheduled")}
                className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold transition cursor-pointer ${
                  activeTab === "scheduled"
                    ? "bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white shadow-sm"
                    : "text-zinc-500 hover:text-zinc-900 dark:hover:text-white"
                }`}
              >
                Scheduled ({scheduledPosts.length})
              </button>

              <button
                onClick={() => setActiveTab("analytics")}
                className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold transition cursor-pointer ${
                  activeTab === "analytics"
                    ? "bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white shadow-sm"
                    : "text-zinc-500 hover:text-zinc-900 dark:hover:text-white"
                }`}
              >
                Analytics & Insights
              </button>
            </div>

            {/* Filter / Search for Feed */}
            {activeTab === "feed" && (
              <div className="flex items-center gap-2.5 w-full sm:w-auto">
                <div className="relative flex-1 sm:w-72 md:w-80">
                  <svg
                    className="w-4 h-4 text-zinc-400 dark:text-zinc-500 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                    strokeWidth={2}
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z" />
                  </svg>
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Search caption..."
                    className="w-full h-9 bg-white dark:bg-[#111114] border border-zinc-200 dark:border-zinc-800 rounded-xl pl-9 pr-8 text-xs font-medium text-zinc-900 dark:text-zinc-200 placeholder:text-zinc-400 dark:placeholder:text-zinc-500 focus:outline-none focus:border-zinc-400 dark:focus:border-zinc-600 hover:border-zinc-300 dark:hover:border-zinc-700 transition shadow-xs"
                  />
                  {searchQuery && (
                    <button
                      type="button"
                      onClick={() => setSearchQuery("")}
                      className="absolute right-2.5 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200 transition p-0.5 cursor-pointer"
                      title="Clear search"
                    >
                      <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                  )}
                </div>

                <div className="w-40 sm:w-44">
                  <DropdownSelect
                    options={filterOptions}
                    value={filterType}
                    onChange={setFilterType}
                    minWidth="176px"
                  />
                </div>
              </div>
            )}
          </div>

          {/* TAB 1: Live Instagram Feed */}
          {activeTab === "feed" && (
            <div>
              {loadingPosts ? (
                <div className="flex flex-col items-center justify-center min-h-[30vh]">
                  <div className="w-6 h-6 border-2 border-zinc-500 border-t-zinc-200 rounded-full animate-spin mb-2" />
                  <p className="text-xs text-zinc-500">Loading feed from Instagram...</p>
                </div>
              ) : filteredPosts.length === 0 ? (
                <div className="p-12 text-center bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl">
                  <p className="text-sm font-semibold text-zinc-700 dark:text-zinc-300">No posts found</p>
                  <p className="text-xs text-zinc-400 mt-1">Click "Create Post" to publish your first post!</p>
                </div>
              ) : (
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
                  {filteredPosts.map((post) => {
                    const isVideo = post.media_type === "VIDEO" || post.media_type === "REELS";
                    const isCarousel = post.media_type === "CAROUSEL_ALBUM";
                    const mediaSrc = post.thumbnail_url || post.media_url;

                    return (
                      <div
                        key={post.id}
                        onClick={() => handleOpenPostDetail(post)}
                        className="group relative aspect-square rounded-xl overflow-hidden bg-zinc-100 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-800 cursor-pointer shadow-sm hover:shadow-md transition"
                      >
                        {mediaSrc ? (
                          <img
                            src={mediaSrc}
                            alt={post.caption || "Instagram post"}
                            className="w-full h-full object-cover group-hover:scale-105 transition duration-300"
                          />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center text-zinc-400">
                            <span className="text-xs">No preview</span>
                          </div>
                        )}

                        {/* Post Type Badge */}
                        <div className="absolute top-2 right-2">
                          {isVideo && (
                            <span className="p-1 bg-black/60 backdrop-blur-md rounded-md text-white flex items-center justify-center">
                              <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 24 24">
                                <path d="M8 5v14l11-7z" />
                              </svg>
                            </span>
                          )}
                          {isCarousel && (
                            <span className="p-1 bg-black/60 backdrop-blur-md rounded-md text-white flex items-center justify-center">
                              <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 24 24">
                                <path d="M4 6H2v14c0 1.1.9 2 2 2h14v-2H4V6zm16-4H8c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2zm0 14H8V4h12v12z" />
                              </svg>
                            </span>
                          )}
                        </div>

                        {/* Overlay Hover Details */}
                        <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition duration-200 flex flex-col justify-between p-3 text-white">
                          <div className="flex items-center justify-between gap-2 text-xs font-bold">
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleDeletePost(post.id, true, post.permalink);
                              }}
                              className="p-1.5 rounded-lg bg-red-600/80 hover:bg-red-600 text-white backdrop-blur-md transition-all duration-150 cursor-pointer shadow-sm hover:scale-105 active:scale-95 flex items-center gap-1 text-[10px]"
                              title="Delete post"
                            >
                              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                <path strokeLinecap="round" strokeLinejoin="round" d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0" />
                              </svg>
                              <span>Delete</span>
                            </button>

                            <div className="flex items-center gap-2">
                              {typeof post.like_count === "number" && post.like_count > 0 && (
                                <span className="flex items-center gap-1">
                                  <svg className="w-3.5 h-3.5 fill-rose-500 text-rose-500" viewBox="0 0 24 24">
                                    <path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z" />
                                  </svg>
                                  {post.like_count}
                                </span>
                              )}
                              {typeof post.comments_count === "number" && post.comments_count > 0 && (
                                <span className="flex items-center gap-1">
                                  <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 24 24">
                                    <path d="M21.99 4c0-1.1-.89-2-1.99-2H4c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h14l4 4-.01-18z" />
                                  </svg>
                                  {post.comments_count}
                                </span>
                              )}
                            </div>
                          </div>

                          <p className="text-[11px] line-clamp-3 font-medium text-zinc-100">
                            {post.caption || "View post"}
                          </p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* TAB 2: Scheduled Posts */}
          {activeTab === "scheduled" && (
            <div className="space-y-4">
              {scheduledPosts.length === 0 ? (
                <div className="p-12 text-center bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl">
                  <div className="w-12 h-12 rounded-xl bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center text-zinc-400 mx-auto mb-3">
                    <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                  </div>
                  <p className="text-sm font-semibold text-zinc-700 dark:text-zinc-300">No scheduled posts</p>
                  <p className="text-xs text-zinc-400 mt-1">Schedule posts ahead of time with auto-publishing</p>
                  <button
                    onClick={() => {
                      setIsScheduleMode(true);
                      setShowCreateModal(true);
                    }}
                    className="mt-4 px-4 py-2 bg-rose-600 hover:bg-rose-500 text-white rounded-xl text-xs font-bold transition shadow-sm"
                  >
                    Schedule Post Now
                  </button>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {scheduledPosts.map((post) => {
                    const scheduledDate = post.scheduledFor ? new Date(post.scheduledFor) : null;
                    const isOverdue = scheduledDate && scheduledDate.getTime() <= Date.now();

                    return (
                      <div
                        key={post.id}
                        className="p-4 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl shadow-sm flex flex-col justify-between gap-3"
                      >
                        <div className="flex items-start gap-3">
                          <div className="w-20 h-20 rounded-xl overflow-hidden bg-zinc-100 dark:bg-zinc-800 flex-shrink-0">
                            {post.mediaType === "VIDEO" ? (
                              <video src={post.mediaUrl} className="w-full h-full object-cover" />
                            ) : (
                              <img src={post.mediaUrl} alt="Scheduled post" className="w-full h-full object-cover" />
                            )}
                          </div>

                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-1.5">
                              <span
                                className={`px-2 py-0.5 text-[10px] font-bold rounded-md ${
                                  isOverdue
                                    ? "bg-amber-100 text-amber-700 dark:bg-amber-950/60 dark:text-amber-300"
                                    : "bg-purple-100 text-purple-700 dark:bg-purple-950/60 dark:text-purple-300"
                                }`}
                              >
                                {isOverdue ? "Publishing soon..." : "Scheduled"}
                              </span>
                              <span className="text-[10px] text-zinc-400 uppercase font-semibold">
                                {post.mediaType}
                              </span>
                            </div>

                            <p className="text-xs font-semibold text-zinc-900 dark:text-white mt-1.5">
                              {scheduledDate ? scheduledDate.toLocaleString() : "Pending"}
                            </p>

                            <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-1 line-clamp-2">
                              {post.caption || "No caption"}
                            </p>
                          </div>
                        </div>

                        <div className="flex items-center gap-2 pt-2 border-t border-zinc-100 dark:border-zinc-800">
                          <button
                            onClick={() => handlePublishScheduledNow(post.id)}
                            disabled={publishingScheduledId === post.id}
                            className="flex-1 py-1.5 bg-rose-600 hover:bg-rose-500 text-white rounded-lg text-xs font-semibold transition flex items-center justify-center gap-1 cursor-pointer disabled:opacity-60"
                          >
                            {publishingScheduledId === post.id ? (
                              <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                            ) : (
                              <span>Publish Now</span>
                            )}
                          </button>

                          <button
                            onClick={() => handleDeletePostLog(post.id)}
                            className="px-3 py-1.5 bg-zinc-100 hover:bg-red-50 hover:text-red-600 dark:bg-zinc-800 dark:hover:bg-red-950/40 dark:hover:text-red-400 text-zinc-600 dark:text-zinc-400 rounded-lg text-xs font-semibold transition cursor-pointer"
                          >
                            Cancel
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* TAB 3: Analytics & Insights */}
          {activeTab === "analytics" && (
            <div className="space-y-6">
              {/* KPI Cards Grid */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                <div className="p-4 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl shadow-sm">
                  <p className="text-xs text-zinc-500 font-medium">Followers</p>
                  <p className="text-2xl font-bold text-zinc-900 dark:text-white mt-1">
                    {currentAccount.followersCount !== null && currentAccount.followersCount !== undefined
                      ? currentAccount.followersCount.toLocaleString()
                      : "—"}
                  </p>
                  <p className="text-[10px] text-zinc-400 mt-1">Live Instagram count</p>
                </div>

                <div className="p-4 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl shadow-sm">
                  <p className="text-xs text-zinc-500 font-medium">Following</p>
                  <p className="text-2xl font-bold text-zinc-900 dark:text-white mt-1">
                    {currentAccount.followsCount !== null && currentAccount.followsCount !== undefined
                      ? currentAccount.followsCount.toLocaleString()
                      : "—"}
                  </p>
                  <p className="text-[10px] text-zinc-400 mt-1">Accounts you follow</p>
                </div>

                <div className="p-4 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl shadow-sm">
                  <p className="text-xs text-zinc-500 font-medium">Total Media Posts</p>
                  <p className="text-2xl font-bold text-zinc-900 dark:text-white mt-1">
                    {Math.max(currentAccount.mediaCount ?? 0, posts.length)}
                  </p>
                  <p className="text-[10px] text-emerald-600 dark:text-emerald-400 mt-1">Published live</p>
                </div>

                <div className="p-4 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl shadow-sm">
                  <p className="text-xs text-zinc-500 font-medium">Scheduled Queue</p>
                  <p className="text-2xl font-bold text-zinc-900 dark:text-white mt-1">
                    {scheduledPosts.length}
                  </p>
                  <p className="text-[10px] text-purple-600 dark:text-purple-400 mt-1">Ready to publish</p>
                </div>
              </div>

              {/* Performance Breakdown Table */}
              <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl overflow-hidden shadow-sm">
                <div className="p-4 border-b border-zinc-200 dark:border-zinc-800 flex items-center justify-between">
                  <h3 className="text-sm font-bold text-zinc-900 dark:text-white">Recent Media Performance</h3>
                  <span className="text-xs text-zinc-400">{posts.length} Total Items</span>
                </div>

                <div className="divide-y divide-zinc-100 dark:divide-zinc-800">
                  {posts.slice(0, 15).map((p) => (
                    <div
                      key={p.id}
                      onClick={() => handleOpenPostDetail(p)}
                      className="p-3.5 flex items-center justify-between hover:bg-zinc-50 dark:hover:bg-zinc-800/50 transition cursor-pointer"
                    >
                      <div className="flex items-center gap-3">
                        <div className="w-12 h-12 rounded-lg overflow-hidden bg-zinc-100 dark:bg-zinc-800 flex-shrink-0">
                          <img
                            src={p.thumbnail_url || p.media_url}
                            alt="thumb"
                            className="w-full h-full object-cover"
                          />
                        </div>
                        <div>
                          <p className="text-xs font-semibold text-zinc-900 dark:text-white line-clamp-1 max-w-sm">
                            {p.caption || "Instagram Media"}
                          </p>
                          <div className="flex items-center gap-2 mt-0.5 text-[11px] text-zinc-400">
                            <span>{p.timestamp ? new Date(p.timestamp).toLocaleDateString() : ""}</span>
                            <span>•</span>
                            <span className="uppercase font-medium">{p.media_type}</span>
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center gap-4 text-xs">
                        <div className="flex items-center gap-1 text-zinc-600 dark:text-zinc-300">
                          <svg className="w-4 h-4 fill-rose-500 text-rose-500" viewBox="0 0 24 24">
                            <path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z" />
                          </svg>
                          <span>{p.like_count ?? 0}</span>
                        </div>

                        <div className="flex items-center gap-1 text-zinc-600 dark:text-zinc-300">
                          <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                            <path d="M21.99 4c0-1.1-.89-2-1.99-2H4c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h14l4 4-.01-18z" />
                          </svg>
                          <span>{p.comments_count ?? 0}</span>
                        </div>

                        <div className="flex items-center gap-2">
                          <span className="text-rose-600 hover:underline text-xs font-semibold">
                            View & Reply →
                          </span>
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleDeletePost(p.id, true, p.permalink);
                            }}
                            className="p-1 text-zinc-400 hover:text-red-600 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/40 rounded-lg transition cursor-pointer"
                            title="Delete post"
                          >
                            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                              <path strokeLinecap="round" strokeLinejoin="round" d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0" />
                            </svg>
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* CREATE POST MODAL */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl w-full max-w-5xl overflow-hidden shadow-2xl flex flex-col max-h-[92vh]">
            {/* Modal Header */}
            <div className="p-4 border-b border-zinc-200 dark:border-zinc-800 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 rounded-lg bg-rose-600 text-white flex items-center justify-center">
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
                  </svg>
                </div>
                <h3 className="text-base font-bold text-zinc-900 dark:text-white">
                  {isScheduleMode ? "Schedule Instagram Post" : "Create New Instagram Post"}
                </h3>
              </div>
              <button
                onClick={() => setShowCreateModal(false)}
                className="w-7 h-7 rounded-lg bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 dark:hover:bg-zinc-700 text-zinc-500 text-sm font-bold transition flex items-center justify-center cursor-pointer"
              >
                &times;
              </button>
            </div>

            {/* Modal Body: 2 Columns */}
            <div className="flex-1 overflow-y-auto grid grid-cols-1 lg:grid-cols-12 divide-y lg:divide-y-0 lg:divide-x divide-zinc-200 dark:divide-zinc-800">
              {/* Left Column: Form Controls */}
              <form onSubmit={handleSubmitPost} className="lg:col-span-7 p-6 space-y-5">
                {/* Post Type Selector */}
                <div>
                  <label className="block text-xs font-bold text-zinc-700 dark:text-zinc-300 uppercase tracking-wider mb-2">
                    Post Type
                  </label>
                  <div className="grid grid-cols-3 gap-2.5">
                    <button
                      type="button"
                      onClick={() => setPostMediaType("IMAGE")}
                      className={`py-2 px-3 rounded-xl border text-xs font-bold flex items-center justify-center gap-1.5 transition cursor-pointer ${
                        postMediaType === "IMAGE"
                          ? "bg-rose-50 dark:bg-rose-950/40 border-rose-500 text-rose-600 dark:text-rose-400 shadow-sm"
                          : "bg-white dark:bg-zinc-900 border-zinc-200 dark:border-zinc-800 text-zinc-700 dark:text-zinc-400"
                      }`}
                    >
                      <span>Photo</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => setPostMediaType("VIDEO")}
                      className={`py-2 px-3 rounded-xl border text-xs font-bold flex items-center justify-center gap-1.5 transition cursor-pointer ${
                        postMediaType === "VIDEO"
                          ? "bg-rose-50 dark:bg-rose-950/40 border-rose-500 text-rose-600 dark:text-rose-400 shadow-sm"
                          : "bg-white dark:bg-zinc-900 border-zinc-200 dark:border-zinc-800 text-zinc-700 dark:text-zinc-400"
                      }`}
                    >
                      <span>Reel / Video</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => setPostMediaType("CAROUSEL")}
                      className={`py-2 px-3 rounded-xl border text-xs font-bold flex items-center justify-center gap-1.5 transition cursor-pointer ${
                        postMediaType === "CAROUSEL"
                          ? "bg-rose-50 dark:bg-rose-950/40 border-rose-500 text-rose-600 dark:text-rose-400 shadow-sm"
                          : "bg-white dark:bg-zinc-900 border-zinc-200 dark:border-zinc-800 text-zinc-700 dark:text-zinc-400"
                      }`}
                    >
                      <span>Carousel Album</span>
                    </button>
                  </div>
                </div>

                {/* Upload or URL Drop Zone */}
                <div>
                  <label className="block text-xs font-bold text-zinc-700 dark:text-zinc-300 uppercase tracking-wider mb-2">
                    Media File or Public HTTPS URL
                  </label>

                  <div
                    onDragEnter={handleDrag}
                    onDragLeave={handleDrag}
                    onDragOver={handleDrag}
                    onDrop={handleDrop}
                    className={`border-2 border-dashed rounded-2xl p-5 text-center transition cursor-pointer ${
                      dragActive
                        ? "border-rose-500 bg-rose-50/20"
                        : "border-zinc-200 dark:border-zinc-800 hover:border-zinc-400 dark:hover:border-zinc-700"
                    }`}
                    onClick={() => fileInputRef.current?.click()}
                  >
                    <input
                      ref={fileInputRef}
                      type="file"
                      multiple={postMediaType === "CAROUSEL"}
                      accept={postMediaType === "VIDEO" ? "video/*" : "image/*,video/*"}
                      onChange={handleFileUpload}
                      className="hidden"
                    />

                    <div className="w-10 h-10 rounded-xl bg-zinc-100 dark:bg-zinc-800 text-zinc-500 flex items-center justify-center mx-auto mb-2">
                      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
                      </svg>
                    </div>

                    <p className="text-xs font-semibold text-zinc-800 dark:text-zinc-200">
                      {uploadingMedia ? "Uploading to Cloudinary..." : "Click to browse or drag & drop files here"}
                    </p>
                    <p className="text-[11px] text-zinc-400 mt-0.5">
                      Supports JPG, PNG, WEBP, MP4, MOV
                    </p>
                  </div>

                  {/* Manual URL Input */}
                  <div className="mt-2.5 flex gap-2">
                    <input
                      type="url"
                      value={mediaUrlInput}
                      onChange={(e) => {
                        setMediaUrlInput(e.target.value);
                        if (postMediaType === "CAROUSEL" && e.target.value) {
                          setCarouselUrls([e.target.value]);
                        }
                      }}
                      placeholder="https://example.com/image.jpg"
                      className="flex-1 px-3 py-2 bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-xl text-xs text-zinc-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-rose-500"
                    />
                  </div>

                  {/* Carousel Items Preview List */}
                  {postMediaType === "CAROUSEL" && carouselUrls.length > 0 && (
                    <div className="mt-2.5 flex items-center gap-2 overflow-x-auto py-1">
                      {carouselUrls.map((u, i) => (
                        <div key={i} className="relative w-14 h-14 rounded-lg overflow-hidden border border-zinc-300 dark:border-zinc-700 flex-shrink-0">
                          <img src={u} alt="carousel item" className="w-full h-full object-cover" />
                          <button
                            type="button"
                            onClick={() => setCarouselUrls((prev) => prev.filter((_, idx) => idx !== i))}
                            className="absolute top-0.5 right-0.5 w-4 h-4 rounded-full bg-black/70 text-white text-[10px] flex items-center justify-center leading-none"
                          >
                            &times;
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Caption & Hashtags */}
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <label className="text-xs font-bold text-zinc-700 dark:text-zinc-300 uppercase tracking-wider">
                      Caption & Hashtags
                    </label>
                    <span className="text-[10px] text-zinc-400 font-medium">
                      {captionInput.length}/2200
                    </span>
                  </div>

                  <textarea
                    rows={4}
                    value={captionInput}
                    onChange={(e) => setCaptionInput(e.target.value)}
                    placeholder="Write an engaging caption with hashtags..."
                    className="w-full p-3 bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-xl text-xs text-zinc-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-rose-500 resize-none leading-relaxed"
                  />

                  {/* Hashtag Quick Chips */}
                  <div className="flex items-center flex-wrap gap-1.5 mt-2">
                    <span className="text-[10px] text-zinc-400 font-semibold">Quick tags:</span>
                    {["#business", "#growth", "#trending", "#tech", "#innovation", "#work", "#success"].map((tag) => (
                      <button
                        key={tag}
                        type="button"
                        onClick={() => appendHashtag(tag)}
                        className="px-2 py-0.5 bg-zinc-100 hover:bg-zinc-200 dark:bg-zinc-800 dark:hover:bg-zinc-700 rounded-md text-[11px] font-medium text-zinc-600 dark:text-zinc-400 transition"
                      >
                        {tag}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Schedule Toggle & Picker */}
                <div className="p-4 bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-2xl space-y-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-xs font-bold text-zinc-900 dark:text-white">Schedule for Later</p>
                      <p className="text-[11px] text-zinc-500 dark:text-zinc-400">
                        Automatically publish post at a specified date and time
                      </p>
                    </div>

                    <button
                      type="button"
                      onClick={() => setIsScheduleMode(!isScheduleMode)}
                      className={`relative inline-flex h-5 w-10 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                        isScheduleMode ? "bg-rose-600" : "bg-zinc-300 dark:bg-zinc-700"
                      }`}
                    >
                      <span
                        className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                          isScheduleMode ? "translate-x-5" : "translate-x-0"
                        }`}
                      />
                    </button>
                  </div>

                  {isScheduleMode && (
                    <div className="pt-2 border-t border-zinc-200 dark:border-zinc-800">
                      <label className="block text-[11px] font-semibold text-zinc-700 dark:text-zinc-300 mb-1">
                        Select Target Date & Time
                      </label>
                      <input
                        type="datetime-local"
                        value={scheduleDateTime}
                        onChange={(e) => setScheduleDateTime(e.target.value)}
                        className="w-full px-3 py-2 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl text-xs text-zinc-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-rose-500"
                      />
                    </div>
                  )}
                </div>

                {/* Action Submit Buttons */}
                <div className="flex items-center justify-end gap-3 pt-2">
                  <button
                    type="button"
                    onClick={() => setShowCreateModal(false)}
                    className="px-4 py-2 bg-zinc-100 hover:bg-zinc-200 dark:bg-zinc-800 dark:hover:bg-zinc-700 text-zinc-700 dark:text-zinc-300 rounded-xl text-xs font-semibold transition cursor-pointer"
                  >
                    Cancel
                  </button>

                  <button
                    type="submit"
                    disabled={submitting || uploadingMedia}
                    className="px-6 py-2.5 bg-gradient-to-r from-rose-600 to-pink-600 hover:from-rose-500 hover:to-pink-500 text-white rounded-xl text-xs font-bold transition shadow-md flex items-center gap-2 cursor-pointer disabled:opacity-60"
                  >
                    {submitting ? (
                      <>
                        <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                        <span>{isScheduleMode ? "Scheduling..." : "Publishing..."}</span>
                      </>
                    ) : (
                      <span>{isScheduleMode ? "Schedule Post" : "Publish Now"}</span>
                    )}
                  </button>
                </div>
              </form>

              {/* Right Column: Live Instagram Mobile Mockup Preview */}
              <div className="lg:col-span-5 p-6 bg-zinc-50 dark:bg-zinc-950 flex flex-col items-center justify-center">
                <p className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest mb-3">
                  Live Feed Preview
                </p>

                {/* Instagram Mockup Card */}
                <div className="w-full max-w-[280px] bg-white dark:bg-zinc-900 rounded-2xl border border-zinc-200 dark:border-zinc-800 shadow-xl overflow-hidden text-zinc-900 dark:text-white">
                  {/* Mockup Header */}
                  <div className="p-3 flex items-center justify-between border-b border-zinc-100 dark:border-zinc-800">
                    <div className="flex items-center gap-2">
                      <div className="w-7 h-7 rounded-full bg-gradient-to-tr from-amber-500 to-rose-500 p-[1.5px]">
                        <div className="w-full h-full rounded-full bg-zinc-800 overflow-hidden flex items-center justify-center text-[10px] text-white font-bold">
                          {currentAccount?.profilePictureUrl ? (
                            <img src={currentAccount.profilePictureUrl} alt="avatar" className="w-full h-full object-cover" />
                          ) : (
                            currentAccount?.username?.charAt(0) || "U"
                          )}
                        </div>
                      </div>
                      <span className="text-xs font-bold">
                        {currentAccount?.username || "instagram_user"}
                      </span>
                    </div>
                    <span className="text-zinc-400 text-xs font-bold tracking-widest">•••</span>
                  </div>

                  {/* Mockup Media Preview */}
                  <div className="relative aspect-square bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center overflow-hidden">
                    {postMediaType === "CAROUSEL" && carouselUrls.length > 0 ? (
                      <img
                        src={carouselUrls[previewSlideIdx] || carouselUrls[0]}
                        alt="Preview"
                        className="w-full h-full object-cover"
                      />
                    ) : mediaUrlInput ? (
                      postMediaType === "VIDEO" ? (
                        <video src={mediaUrlInput} className="w-full h-full object-cover" autoPlay loop muted />
                      ) : (
                        <img src={mediaUrlInput} alt="Preview" className="w-full h-full object-cover" />
                      )
                    ) : (
                      <div className="text-center p-4 text-zinc-400">
                        <svg className="w-8 h-8 mx-auto mb-1 opacity-50" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                        </svg>
                        <p className="text-[11px]">Media preview will appear here</p>
                      </div>
                    )}

                    {/* Carousel Dots */}
                    {postMediaType === "CAROUSEL" && carouselUrls.length > 1 && (
                      <div className="absolute bottom-2 left-0 right-0 flex items-center justify-center gap-1">
                        {carouselUrls.map((_, dotIdx) => (
                          <button
                            key={dotIdx}
                            type="button"
                            onClick={() => setPreviewSlideIdx(dotIdx)}
                            className={`w-1.5 h-1.5 rounded-full transition ${
                              previewSlideIdx === dotIdx ? "bg-white scale-125" : "bg-white/50"
                            }`}
                          />
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Mockup Icons Bar */}
                  <div className="p-3 space-y-2">
                    <div className="flex items-center justify-between text-zinc-700 dark:text-zinc-200">
                      <div className="flex items-center gap-3">
                        <svg className="w-4 h-4 hover:text-rose-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
                        </svg>
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                        </svg>
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
                        </svg>
                      </div>
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M5 5a2 2 0 012-2h10a2 2 0 012 2v16l-7-3.5L5 21V5z" />
                      </svg>
                    </div>

                    <p className="text-[11px] text-zinc-800 dark:text-zinc-200 line-clamp-2">
                      <strong className="font-bold text-zinc-900 dark:text-white mr-1">
                        {currentAccount?.username || "user"}
                      </strong>
                      {captionInput || "Your caption text will appear here..."}
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* POST DETAIL & LIVE COMMENTS MODAL */}
      {viewingPost && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 lg:p-8 bg-black/80 backdrop-blur-md animate-in fade-in duration-200">
          <div className="bg-white dark:bg-[#0f0f12] border border-zinc-200 dark:border-zinc-800 rounded-2xl w-full max-w-6xl xl:max-w-7xl overflow-hidden shadow-2xl flex flex-col md:flex-row h-full max-h-[88vh]">
            {/* Left: Media Preview */}
            <div className="md:w-[58%] lg:w-[62%] bg-black flex items-center justify-center relative overflow-hidden p-2">
              {viewingPost.media_type === "VIDEO" || viewingPost.media_type === "REELS" ? (
                <video src={viewingPost.media_url} controls className="max-h-[84vh] w-full h-full object-contain" />
              ) : (
                <img
                  src={viewingPost.media_url || viewingPost.thumbnail_url}
                  alt={viewingPost.caption || "Post"}
                  className="max-h-[84vh] w-full h-full object-contain"
                />
              )}
            </div>

            {/* Right: Caption, Metrics & Live Comments */}
            <div className="md:w-[42%] lg:w-[38%] flex flex-col justify-between bg-white dark:bg-[#111114] border-t md:border-t-0 md:border-l border-zinc-200 dark:border-zinc-800 min-h-0">
              {/* Header */}
              <div className="p-4 sm:p-5 border-b border-zinc-200 dark:border-zinc-800 flex items-center justify-between shrink-0">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-full bg-zinc-200 dark:bg-zinc-800 overflow-hidden flex items-center justify-center font-bold shrink-0">
                    {currentAccount?.profilePictureUrl ? (
                      <img src={currentAccount.profilePictureUrl} alt="avatar" className="w-full h-full object-cover" />
                    ) : (
                      currentAccount?.username?.charAt(0) || "U"
                    )}
                  </div>
                  <div>
                    <p className="text-sm font-bold text-zinc-900 dark:text-white leading-tight">
                      @{currentAccount?.username || "instagram_user"}
                    </p>
                    <p className="text-xs text-zinc-500 dark:text-zinc-400 leading-tight mt-0.5">
                      {viewingPost.timestamp ? new Date(viewingPost.timestamp).toLocaleString() : ""}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    onClick={() => viewingPost && fetchComments(viewingPost.id)}
                    disabled={loadingComments}
                    className="px-3.5 py-1.5 bg-white dark:bg-[#111114] hover:bg-zinc-100 dark:hover:bg-zinc-800 text-zinc-700 dark:text-zinc-200 border border-zinc-200 dark:border-zinc-800 hover:border-zinc-300 dark:hover:border-zinc-700 rounded-xl text-xs font-semibold transition-all duration-150 shadow-xs flex items-center gap-1.5 cursor-pointer disabled:opacity-60 active:scale-97"
                    title="Live refresh comments"
                  >
                    <svg className={`w-3.5 h-3.5 ${loadingComments ? "animate-spin text-blue-500" : ""}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0l3.181 3.183a8.25 8.25 0 0013.803-3.7M4.031 9.865a8.25 8.25 0 0113.803-3.7l3.181 3.182m0-4.991v4.99" />
                    </svg>
                    <span>{loadingComments ? "Syncing..." : "Sync Comments"}</span>
                  </button>
                  {viewingPost.permalink && (
                    <a
                      href={viewingPost.permalink}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="p-1.5 bg-white dark:bg-[#111114] hover:bg-zinc-100 dark:hover:bg-zinc-800 text-zinc-600 dark:text-zinc-300 border border-zinc-200 dark:border-zinc-800 rounded-xl transition-all duration-150 shadow-xs"
                      title="Open on Instagram"
                    >
                      <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                        <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838c-3.403 0-6.162 2.759-6.162 6.162s2.759 6.163 6.162 6.163 6.162-2.759 6.162-6.163c0-3.403-2.759-6.162-6.162-6.162zm0 10.162c-2.209 0-4-1.79-4-4 0-2.209 1.791-4 4-4s4 1.791 4 4c0 2.21-1.791 4-4 4zm6.406-11.845c-.796 0-1.441.645-1.441 1.44s.645 1.44 1.441 1.44c.795 0 1.439-.645 1.439-1.44s-.644-1.44-1.439-1.44z" />
                      </svg>
                    </a>
                  )}
                  <button
                    onClick={() => handleDeletePost(viewingPost.id, true, viewingPost.permalink)}
                    className="px-3 py-1.5 bg-red-50 hover:bg-red-100 dark:bg-red-950/40 dark:hover:bg-red-900/60 text-red-600 dark:text-red-400 border border-red-200 dark:border-red-900/50 rounded-xl text-xs font-semibold transition-all duration-150 shadow-xs flex items-center gap-1.5 cursor-pointer active:scale-97"
                    title="Delete Post"
                  >
                    <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0" />
                    </svg>
                    <span>Delete</span>
                  </button>
                  <button
                    onClick={() => setViewingPost(null)}
                    className="p-1.5 text-zinc-400 hover:text-zinc-700 dark:hover:text-white rounded-xl hover:bg-zinc-100 dark:hover:bg-zinc-800 transition cursor-pointer"
                  >
                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>
              </div>

              {/* Caption & Metadata */}
              <div className="p-4 sm:p-5 overflow-y-auto flex-1 space-y-4">
                {viewingPost.caption && (
                  <div>
                    <p className="text-xs text-zinc-500 dark:text-zinc-400 font-semibold mb-1">CAPTION</p>
                    <p className="text-xs text-zinc-800 dark:text-zinc-200 whitespace-pre-wrap leading-relaxed">
                      {viewingPost.caption}
                    </p>
                  </div>
                )}

                {/* Metrics Grid */}
                <div className="grid grid-cols-2 gap-2">
                  <div className="p-2.5 bg-slate-50 dark:bg-zinc-900/60 border border-zinc-200 dark:border-zinc-800 rounded-xl text-center">
                    <p className="text-[10px] font-semibold text-zinc-500 uppercase tracking-wider">Likes</p>
                    <p className="text-base font-bold text-zinc-900 dark:text-white mt-0.5">
                      {(viewingPost.like_count ?? 0).toLocaleString()}
                    </p>
                  </div>
                  <div className="p-2.5 bg-slate-50 dark:bg-zinc-900/60 border border-zinc-200 dark:border-zinc-800 rounded-xl text-center">
                    <p className="text-[10px] font-semibold text-zinc-500 uppercase tracking-wider">Comments</p>
                    <p className="text-base font-bold text-zinc-900 dark:text-white mt-0.5">
                      {postComments.length > 0 ? postComments.length : (viewingPost.comments_count ?? 0)}
                    </p>
                  </div>
                </div>

                {/* Live Comments Thread */}
                <div className="pt-2">
                  <div className="flex items-center justify-between mb-2">
                    <p className="text-xs text-zinc-500 dark:text-zinc-400 font-semibold uppercase tracking-wider">
                      Live Comments ({postComments.length})
                    </p>
                  </div>

                  {loadingComments ? (
                    <div className="py-8 flex flex-col items-center justify-center gap-2">
                      <div className="w-5 h-5 border-2 border-zinc-500 border-t-zinc-200 rounded-full animate-spin" />
                      <span className="text-xs text-zinc-500">Syncing live comments from Instagram...</span>
                    </div>
                  ) : postComments.length === 0 ? (
                    <div className="py-6 text-center text-xs text-zinc-400 bg-slate-50 dark:bg-zinc-900/40 rounded-xl border border-zinc-200 dark:border-zinc-800">
                      No comments on this post yet.
                    </div>
                  ) : (
                    <div className="space-y-2.5 max-h-[36vh] overflow-y-auto pr-1">
                      {postComments.map((comment: InstagramComment) => (
                        <div
                          key={comment.id}
                          className="p-3 bg-slate-50 dark:bg-zinc-900/60 border border-zinc-200 dark:border-zinc-800 rounded-xl text-xs space-y-1"
                        >
                          <div className="flex items-center justify-between">
                            <span className="font-bold text-zinc-900 dark:text-white">
                              @{comment.username || "user"}
                            </span>
                            <span className="text-[10px] text-zinc-400">
                              {comment.timestamp ? new Date(comment.timestamp).toLocaleDateString() : ""}
                            </span>
                          </div>
                          <p className="text-zinc-700 dark:text-zinc-300 leading-relaxed break-words">
                            {comment.text}
                          </p>
                          <div className="pt-1 flex items-center justify-end">
                            <button
                              type="button"
                              onClick={() => {
                                setReplyToCommentId(comment.id);
                                setNewCommentText(`@${comment.username || "user"} `);
                              }}
                              className="text-[11px] font-semibold text-blue-600 dark:text-blue-400 hover:underline cursor-pointer flex items-center gap-1"
                            >
                              <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                <path strokeLinecap="round" strokeLinejoin="round" d="M3 10h10a8 8 0 018 8v2M3 10l6 6m-6-6l6-6" />
                              </svg>
                              <span>Reply</span>
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              {/* Replying Indicator Banner */}
              {replyToCommentId && (
                <div className="px-4 py-2 bg-blue-50 dark:bg-blue-950/40 border-t border-blue-200 dark:border-blue-900/50 flex items-center justify-between text-xs text-blue-700 dark:text-blue-300">
                  <span className="font-medium">Replying directly to comment thread...</span>
                  <button
                    type="button"
                    onClick={() => {
                      setReplyToCommentId(null);
                      setNewCommentText("");
                    }}
                    className="text-[11px] font-bold text-blue-600 dark:text-blue-400 hover:underline cursor-pointer"
                  >
                    Cancel
                  </button>
                </div>
              )}

              {/* Post Comment Input */}
              <form onSubmit={handlePostComment} className="p-3 sm:p-4 border-t border-zinc-200 dark:border-zinc-800 flex items-center gap-2.5 bg-white dark:bg-[#111114] shrink-0">
                <input
                  type="text"
                  value={newCommentText}
                  onChange={(e) => setNewCommentText(e.target.value)}
                  placeholder={replyToCommentId ? "Replying to comment..." : "Write a comment or reply..."}
                  className="flex-1 px-4 py-2.5 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl text-xs text-zinc-900 dark:text-white placeholder:text-zinc-400 dark:placeholder:text-zinc-500 focus:outline-none focus:border-zinc-400 dark:focus:border-zinc-600 transition shadow-xs"
                />
                <button
                  type="submit"
                  disabled={submittingComment || !newCommentText.trim()}
                  className="px-4 py-2.5 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-xs font-bold transition disabled:opacity-50 cursor-pointer shadow-xs shrink-0 active:scale-97"
                >
                  {submittingComment ? "Posting..." : "Post"}
                </button>
              </form>
            </div>
          </div>
        </div>
      )}
      {/* DELETE / DISCONNECT CONFIRMATION MODAL POPUP */}
      {deleteConfirmState.isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-xs animate-in fade-in duration-150">
          <div className="bg-white dark:bg-[#111114] border border-zinc-200 dark:border-zinc-800 rounded-2xl w-full max-w-md overflow-hidden shadow-2xl animate-in zoom-in-95 duration-150">
            <div className="p-5 sm:p-6">
              <div className="flex items-start gap-3.5">
                <div className="w-10 h-10 rounded-xl bg-red-500/10 border border-red-500/20 text-red-500 flex items-center justify-center shrink-0">
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
                  </svg>
                </div>
                <div className="flex-1 min-w-0">
                  <h3 className="text-base font-bold text-zinc-900 dark:text-white">
                    {deleteConfirmState.title}
                  </h3>
                  <p className="text-xs text-zinc-600 dark:text-zinc-400 mt-1.5 leading-relaxed">
                    {deleteConfirmState.description}
                  </p>

                  {deleteConfirmState.isLive && (
                    <div className="mt-3 p-3 rounded-xl bg-amber-500/10 border border-amber-500/20 text-xs text-amber-700 dark:text-amber-300 space-y-1">
                      <div className="font-bold flex items-center gap-1.5">
                        <span>⚠️</span>
                        <span>Meta (Instagram) API Limitation</span>
                      </div>
                      <p className="text-[11px] leading-relaxed text-zinc-600 dark:text-zinc-400">
                        Meta prohibits any third-party app from deleting published media directly from Instagram servers. To remove this post from your actual Instagram profile, tap <strong>"Open on Instagram & Delete"</strong> below.
                      </p>
                    </div>
                  )}
                </div>
              </div>
            </div>

            <div className="px-5 py-3.5 bg-zinc-50 dark:bg-[#18181c] border-t border-zinc-200 dark:border-zinc-800/80 flex items-center justify-end gap-2.5 flex-wrap">
              <button
                type="button"
                onClick={() => setDeleteConfirmState({ isOpen: false, id: "", title: "", description: "" })}
                disabled={deleteConfirmState.isDeleting}
                className="px-4 py-2 rounded-xl text-xs font-semibold text-zinc-700 dark:text-zinc-300 hover:bg-zinc-200/70 dark:hover:bg-zinc-800 border border-zinc-200 dark:border-zinc-700/60 transition cursor-pointer disabled:opacity-50"
              >
                Cancel
              </button>

              {deleteConfirmState.isLive && deleteConfirmState.permalink && (
                <a
                  href={deleteConfirmState.permalink}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="px-4 py-2 rounded-xl text-xs font-semibold text-rose-600 dark:text-rose-400 bg-rose-50 dark:bg-rose-950/40 hover:bg-rose-100 dark:hover:bg-rose-900/60 border border-rose-200 dark:border-rose-900/50 transition flex items-center gap-1.5 cursor-pointer shadow-xs"
                  title="Open post directly on Instagram to delete or archive"
                >
                  <span>Open on Instagram & Delete</span>
                  <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 6H5.25A2.25 2.25 0 003 8.25v10.5A2.25 2.25 0 005.25 21h10.5A2.25 2.25 0 0018 18.75V10.5m-10.5 6L21 3m0 0h-5.25M21 3v5.25" />
                  </svg>
                </a>
              )}

              <button
                type="button"
                onClick={handleConfirmAction}
                disabled={deleteConfirmState.isDeleting}
                className="px-4 py-2 rounded-xl text-xs font-semibold text-white bg-red-600 hover:bg-red-500 shadow-xs transition flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
              >
                {deleteConfirmState.isDeleting ? (
                  <>
                    <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    <span>Processing...</span>
                  </>
                ) : (
                  <>
                    <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0" />
                    </svg>
                    <span>
                      {deleteConfirmState.actionType === "disconnect"
                        ? "Disconnect"
                        : deleteConfirmState.isLive
                        ? "Remove from Workspace"
                        : "Delete Post"}
                    </span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
