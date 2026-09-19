"use client";

import { Suspense, useEffect, useState, useRef, useCallback } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import ThemeToggle from "@/components/ThemeToggle";

interface Toast {
  id: number;
  type: "success" | "error" | "warning" | "info";
  message: string;
}

function AcceptInvitationForm() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const token = searchParams.get("token");

  const [loading, setLoading] = useState(true);
  const [slowVerification, setSlowVerification] = useState(false);
  const [verificationFailed, setVerificationFailed] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);
  const [userName, setUserName] = useState("");
  const [userEmail, setUserEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [slowSubmitting, setSlowSubmitting] = useState(false);
  const [isOnline, setIsOnline] = useState(true);
  const [toast, setToast] = useState<Toast | null>(null);

  const toastTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const slowTimerRef = useRef<NodeJS.Timeout | null>(null);

  const showToast = useCallback((type: Toast["type"], message: string, duration = 6000) => {
    if (toastTimeoutRef.current) clearTimeout(toastTimeoutRef.current);
    const id = Date.now();
    setToast({ id, type, message });
    toastTimeoutRef.current = setTimeout(() => {
      setToast((current) => (current?.id === id ? null : current));
    }, duration);
  }, []);

  const dismissToast = useCallback(() => {
    if (toastTimeoutRef.current) clearTimeout(toastTimeoutRef.current);
    setToast(null);
  }, []);

  // Online / Offline monitor
  useEffect(() => {
    setIsOnline(navigator.onLine);

    const handleOnline = () => {
      setIsOnline(true);
      showToast("info", "Internet connection restored.", 4000);
    };

    const handleOffline = () => {
      setIsOnline(false);
      showToast("error", "You are currently offline. Please check your internet connection.", 8000);
    };

    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);

    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, [showToast]);

  // Invitation token verification with timeout & slow network detection
  const verifyInvitation = useCallback(async () => {
    if (!token) {
      setError("No invitation token provided. Please check your invitation link.");
      setLoading(false);
      setVerificationFailed(true);
      return;
    }

    setLoading(true);
    setSlowVerification(false);
    setVerificationFailed(false);
    setError("");

    // Detect slow network after 3.5s
    const slowTimer = setTimeout(() => {
      setSlowVerification(true);
    }, 3500);

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 20000);

    try {
      const res = await fetch(`/api/admin/team/accept-invitation?token=${encodeURIComponent(token)}`, {
        signal: controller.signal,
      });

      clearTimeout(slowTimer);
      clearTimeout(timeoutId);

      const data = await res.json();

      if (!res.ok || data.error) {
        setError(data.error || "Invalid invitation link.");
        setVerificationFailed(true);
      } else if (data.valid) {
        setUserName(data.user.name);
        setUserEmail(data.user.email);
      }
    } catch (err: any) {
      clearTimeout(slowTimer);
      clearTimeout(timeoutId);
      setVerificationFailed(true);

      if (err.name === "AbortError") {
        setError("Network connection is very slow or timed out. Please check your internet connection.");
        showToast("warning", "Verification timed out due to slow network.", 6000);
      } else if (!navigator.onLine) {
        setError("You are currently offline. Please reconnect to the internet.");
        showToast("error", "Offline: Check your internet connection.", 6000);
      } else {
        setError("Unable to reach the server. Please check your internet connection.");
        showToast("error", "Network error while verifying invitation.", 6000);
      }
    } finally {
      setLoading(false);
      setSlowVerification(false);
    }
  }, [token, showToast]);

  useEffect(() => {
    verifyInvitation();
  }, [verifyInvitation]);

  // Form submission with slow network feedback & abort controller
  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");

    if (!navigator.onLine) {
      setError("Cannot submit while offline. Please check your internet connection.");
      showToast("error", "You are currently offline.", 5000);
      return;
    }

    if (password !== confirmPassword) {
      setError("Passwords do not match");
      return;
    }

    if (password.length < 8) {
      setError("Password must be at least 8 characters");
      return;
    }

    setSubmitting(true);
    setSlowSubmitting(false);

    // If request takes longer than 3.5s, warn user that network is slow
    slowTimerRef.current = setTimeout(() => {
      setSlowSubmitting(true);
      showToast(
        "warning",
        "Connection is slow. Still setting up your account, please do not close this window...",
        10000
      );
    }, 3500);

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 30000);

    try {
      const res = await fetch("/api/admin/team/accept-invitation", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, password, confirmPassword }),
        signal: controller.signal,
      });

      if (slowTimerRef.current) clearTimeout(slowTimerRef.current);
      clearTimeout(timeoutId);

      const data = await res.json();

      if (!res.ok) {
        const errorMsg = data.error || "Failed to activate account";
        setError(errorMsg);
        showToast("error", errorMsg, 6000);
        setSubmitting(false);
        setSlowSubmitting(false);
        return;
      }

      setSuccess(true);
      showToast("success", "Account activated successfully! Redirecting to login...", 4000);
      setTimeout(() => router.push("/login"), 3000);
    } catch (err: any) {
      if (slowTimerRef.current) clearTimeout(slowTimerRef.current);
      clearTimeout(timeoutId);
      setSubmitting(false);
      setSlowSubmitting(false);

      if (err.name === "AbortError") {
        const msg = "Request timed out due to a slow network connection. Your account may still be activating. Please try again.";
        setError(msg);
        showToast("error", "Request timed out due to slow network.", 7000);
      } else if (!navigator.onLine) {
        const msg = "Network connection lost during setup. Please reconnect and try again.";
        setError(msg);
        showToast("error", msg, 7000);
      } else {
        const msg = "Network error: unable to reach the server. Please check your internet connection and try again.";
        setError(msg);
        showToast("error", msg, 7000);
      }
    }
  }

  return (
    <>
      {/* Floating Toast Notification */}
      {toast && (
        <div
          role="alert"
          aria-live="assertive"
          className={`fixed bottom-6 right-6 z-[100] max-w-md px-4 py-3 rounded-2xl text-sm font-medium shadow-2xl flex items-center gap-3 transition-all duration-300 animate-in slide-in-from-bottom-3 fade-in border ${
            toast.type === "success"
              ? "bg-emerald-600 text-white border-emerald-500 shadow-emerald-950/20"
              : toast.type === "warning"
              ? "bg-amber-600 text-white border-amber-500 shadow-amber-950/20"
              : toast.type === "info"
              ? "bg-blue-600 text-white border-blue-500 shadow-blue-950/20"
              : "bg-red-600 text-white border-red-500 shadow-red-950/20"
          }`}
        >
          {toast.type === "success" && (
            <svg className="w-5 h-5 text-white shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          )}
          {toast.type === "warning" && (
            <svg className="w-5 h-5 text-white shrink-0 animate-pulse" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
            </svg>
          )}
          {toast.type === "info" && (
            <svg className="w-5 h-5 text-white shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M11.25 11.25l.041-.02a.75.75 0 011.063.852l-.708 2.836a.75.75 0 001.063.853l.041-.021M21 12a9 9 0 11-18 0 9 9 0 0118 0zm-9-3.75h.008v.008H12V8.25z" />
            </svg>
          )}
          {toast.type === "error" && (
            <svg className="w-5 h-5 text-white shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z" />
            </svg>
          )}
          <span className="flex-1 text-xs leading-relaxed">{toast.message}</span>
          <button
            onClick={dismissToast}
            className="p-1 -mr-1 text-white/80 hover:text-white rounded-lg hover:bg-white/10 transition"
            aria-label="Dismiss notification"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      )}

      {/* Offline Banner */}
      {!isOnline && (
        <div className="fixed top-0 left-0 right-0 z-50 bg-amber-500 text-white px-4 py-2 text-xs font-semibold flex items-center justify-center gap-2 shadow-md">
          <svg className="w-4 h-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M3 3l18 18M12 18h.01M8.5 14.5a5 5 0 017 0M5 11a10 10 0 0114 0" />
          </svg>
          <span>You are currently offline. Please check your internet connection.</span>
        </div>
      )}

      {/* Initial Verification Loading State */}
      {loading && (
        <div className="w-full max-w-sm bg-white dark:bg-[#121216] border border-zinc-200 dark:border-zinc-800/80 p-8 rounded-3xl shadow-2xl text-center space-y-4">
          <div className="w-14 h-14 rounded-2xl bg-blue-50 dark:bg-blue-500/10 border border-blue-200 dark:border-blue-500/20 flex items-center justify-center mx-auto">
            <div className="w-6 h-6 border-2 border-zinc-300 dark:border-zinc-600 border-t-blue-600 dark:border-t-blue-400 rounded-full animate-spin" />
          </div>
          <h2 className="text-lg font-bold text-zinc-900 dark:text-white tracking-tight">
            Verifying Invitation...
          </h2>
          <p className="text-zinc-500 dark:text-zinc-400 text-xs leading-relaxed">
            Please wait while we validate your invitation link with the server.
          </p>

          {/* Slow connection banner during verification */}
          {slowVerification && (
            <div className="mt-4 p-3 bg-amber-50 dark:bg-amber-500/10 border border-amber-200 dark:border-amber-500/20 rounded-xl text-left flex items-start gap-2.5 animate-in fade-in duration-300">
              <svg className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5 animate-pulse" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z" />
              </svg>
              <div className="text-xs text-amber-700 dark:text-amber-300">
                <span className="font-semibold block">Slow connection detected</span>
                Connecting is taking longer than usual. Please stay on this page.
              </div>
            </div>
          )}
        </div>
      )}

      {/* Verification Failed State (Invalid, expired, or network failure) */}
      {!loading && verificationFailed && (
        <div className="w-full max-w-sm bg-white dark:bg-[#121216] border border-zinc-200 dark:border-zinc-800/80 p-8 rounded-3xl shadow-2xl text-center space-y-4">
          <div className="w-14 h-14 rounded-2xl bg-red-50 dark:bg-red-500/10 border border-red-200 dark:border-red-500/20 flex items-center justify-center mx-auto">
            <svg className="w-7 h-7 text-red-600 dark:text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z" />
            </svg>
          </div>
          <h2 className="text-xl font-bold text-zinc-900 dark:text-white tracking-tight">
            Invitation Error
          </h2>
          <div className="bg-red-50 dark:bg-red-500/10 border border-red-200 dark:border-red-500/20 text-red-700 dark:text-red-400 text-xs px-3.5 py-3 rounded-xl leading-relaxed text-left">
            {error || "We could not verify this invitation link."}
          </div>

          <div className="pt-2 space-y-2">
            <button
              onClick={verifyInvitation}
              className="w-full py-2.5 px-4 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-500 rounded-xl transition cursor-pointer shadow-md flex items-center justify-center gap-2"
            >
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0l3.181 3.183a8.25 8.25 0 0013.803-3.7M4.031 9.865a8.25 8.25 0 0113.803-3.7l3.181 3.182m0-4.991v4.99" />
              </svg>
              <span>Retry Verification</span>
            </button>
            <button
              onClick={() => router.push("/")}
              className="w-full py-2 text-xs font-medium text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white transition"
            >
              Back to Login
            </button>
          </div>
        </div>
      )}

      {/* Success State */}
      {!loading && success && (
        <div className="w-full max-w-sm bg-white dark:bg-[#121216] border border-zinc-200 dark:border-zinc-800/80 p-8 rounded-3xl shadow-2xl text-center space-y-4">
          <div className="w-14 h-14 rounded-2xl bg-emerald-50 dark:bg-emerald-500/10 border border-emerald-200 dark:border-emerald-500/20 flex items-center justify-center mx-auto">
            <svg className="w-7 h-7 text-emerald-600 dark:text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <h1 className="text-2xl font-bold text-zinc-900 dark:text-white tracking-tight">
            Account Activated!
          </h1>
          <p className="text-zinc-500 dark:text-zinc-400 text-xs leading-relaxed">
            Your password has been configured. Redirecting you to the login page...
          </p>
          <div className="flex items-center justify-center gap-2 pt-2 text-blue-600 dark:text-blue-400 text-xs font-medium">
            <div className="w-4 h-4 border-2 border-blue-600 dark:border-blue-400 border-t-transparent rounded-full animate-spin" />
            <span>Redirecting...</span>
          </div>
        </div>
      )}

      {/* Main Form State */}
      {!loading && !verificationFailed && !success && (
        <div className="w-full max-w-sm bg-white dark:bg-[#121216] border border-zinc-200 dark:border-zinc-800/80 p-8 rounded-3xl shadow-2xl text-center">
          <div className="w-14 h-14 rounded-2xl bg-blue-50 dark:bg-blue-500/10 border border-blue-200 dark:border-blue-500/20 flex items-center justify-center mx-auto mb-5">
            <svg className="w-7 h-7 text-blue-600 dark:text-blue-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 10.5V6.75a4.5 4.5 0 10-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 002.25-2.25v-6.75a2.25 2.25 0 00-2.25-2.25H6.75a2.25 2.25 0 00-2.25 2.25v6.75a2.25 2.25 0 002.25 2.25z" />
            </svg>
          </div>

          <h1 className="text-2xl font-bold text-zinc-900 dark:text-white tracking-tight">
            Set Up Your Account
          </h1>
          <p className="text-zinc-500 dark:text-zinc-400 text-xs mt-1.5 leading-relaxed">
            {userName ? (
              <>
                Welcome, <strong className="text-zinc-800 dark:text-zinc-200">{userName}</strong>!
              </>
            ) : (
              "Welcome!"
            )}{" "}
            Create a secure password to access your admin workspace.
          </p>
          {userEmail && (
            <div className="mt-2 inline-flex items-center gap-1.5 px-2.5 py-1 bg-zinc-100 dark:bg-zinc-800/60 rounded-lg text-[11px] text-zinc-600 dark:text-zinc-400 font-mono">
              <svg className="w-3 h-3 text-zinc-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M21.75 6.75v10.5a2.25 2.25 0 01-2.25 2.25h-15a2.25 2.25 0 01-2.25-2.25V6.75m19.5 0A2.25 2.25 0 0019.5 4.5h-15a2.25 2.25 0 00-2.25 2.25m19.5 0v.243a2.25 2.25 0 01-1.07 1.916l-7.5 4.615a2.25 2.25 0 01-2.36 0L3.32 8.91a2.25 2.25 0 01-1.07-1.916V6.75" />
              </svg>
              <span>{userEmail}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4 mt-6 text-left">
            {error && (
              <div className="bg-red-50 dark:bg-red-500/10 border border-red-200 dark:border-red-500/20 text-red-600 dark:text-red-400 text-xs px-3.5 py-2.5 rounded-xl flex items-start gap-2">
                <svg className="w-4 h-4 shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z" />
                </svg>
                <span>{error}</span>
              </div>
            )}

            {/* Slow Network In-Form Warning */}
            {slowSubmitting && submitting && (
              <div className="bg-amber-50 dark:bg-amber-500/10 border border-amber-200 dark:border-amber-500/20 text-amber-700 dark:text-amber-300 text-xs px-3.5 py-2.5 rounded-xl flex items-start gap-2 animate-in fade-in duration-200">
                <svg className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5 animate-pulse" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z" />
                </svg>
                <div className="space-y-0.5">
                  <span className="font-semibold block">Network connection is slow</span>
                  <span className="text-[11px] leading-relaxed block text-amber-800 dark:text-amber-200">
                    Still activating your account securely. Please do not close or reload this page.
                  </span>
                </div>
              </div>
            )}

            <div>
              <label className="block text-xs font-semibold text-zinc-600 dark:text-zinc-400 mb-1.5">
                Password
              </label>
              <div className="relative">
                <input
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  disabled={submitting}
                  required
                  minLength={8}
                  autoFocus
                  className="w-full bg-slate-50 dark:bg-zinc-900/90 border border-zinc-200 dark:border-zinc-800 rounded-xl pl-3.5 pr-10 py-2.5 text-sm text-zinc-900 dark:text-white placeholder:text-zinc-400 dark:placeholder:text-zinc-600 focus:outline-none focus:ring-2 focus:ring-blue-500 transition disabled:opacity-50"
                  placeholder="At least 8 characters"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  tabIndex={-1}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300 p-0.5 transition"
                  aria-label={showPassword ? "Hide password" : "Show password"}
                >
                  {showPassword ? (
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M3.98 8.223A10.477 10.477 0 001.934 12C3.226 16.338 7.244 19.5 12 19.5c.993 0 1.953-.138 2.863-.395M6.228 6.228A10.45 10.45 0 0112 4.5c4.756 0 8.773 3.162 10.065 7.498a10.523 10.523 0 01-4.293 5.774M6.228 6.228L3 3m3.228 3.228l3.65 3.65m7.894 7.894L21 21m-3.228-3.228l-3.65-3.65m0 0a3 3 0 10-4.243-4.243m4.242 4.242L9.88 9.88" />
                    </svg>
                  ) : (
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M2.036 12.322a1.012 1.012 0 010-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178z" />
                      <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                    </svg>
                  )}
                </button>
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-zinc-600 dark:text-zinc-400 mb-1.5">
                Confirm Password
              </label>
              <div className="relative">
                <input
                  type={showConfirmPassword ? "text" : "password"}
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  disabled={submitting}
                  required
                  minLength={8}
                  className="w-full bg-slate-50 dark:bg-zinc-900/90 border border-zinc-200 dark:border-zinc-800 rounded-xl pl-3.5 pr-10 py-2.5 text-sm text-zinc-900 dark:text-white placeholder:text-zinc-400 dark:placeholder:text-zinc-600 focus:outline-none focus:ring-2 focus:ring-blue-500 transition disabled:opacity-50"
                  placeholder="Repeat your password"
                />
                <button
                  type="button"
                  onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                  tabIndex={-1}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300 p-0.5 transition"
                  aria-label={showConfirmPassword ? "Hide password" : "Show password"}
                >
                  {showConfirmPassword ? (
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M3.98 8.223A10.477 10.477 0 001.934 12C3.226 16.338 7.244 19.5 12 19.5c.993 0 1.953-.138 2.863-.395M6.228 6.228A10.45 10.45 0 0112 4.5c4.756 0 8.773 3.162 10.065 7.498a10.523 10.523 0 01-4.293 5.774M6.228 6.228L3 3m3.228 3.228l3.65 3.65m7.894 7.894L21 21m-3.228-3.228l-3.65-3.65m0 0a3 3 0 10-4.243-4.243m4.242 4.242L9.88 9.88" />
                    </svg>
                  ) : (
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M2.036 12.322a1.012 1.012 0 010-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178z" />
                      <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                    </svg>
                  )}
                </button>
              </div>
            </div>

            {/* Realtime password match feedback */}
            {confirmPassword.length > 0 && (
              <div className="text-[11px] flex items-center gap-1.5">
                {password === confirmPassword ? (
                  <span className="text-emerald-600 dark:text-emerald-400 flex items-center gap-1">
                    <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                    </svg>
                    Passwords match
                  </span>
                ) : (
                  <span className="text-amber-600 dark:text-amber-400 flex items-center gap-1">
                    <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                    </svg>
                    Passwords do not match yet
                  </span>
                )}
              </div>
            )}

            <button
              type="submit"
              disabled={submitting || !isOnline}
              className="w-full py-2.5 text-sm font-semibold text-white bg-blue-600 hover:bg-blue-500 disabled:opacity-40 disabled:cursor-not-allowed rounded-xl transition cursor-pointer shadow-md mt-2 flex items-center justify-center gap-2"
            >
              {submitting ? (
                <>
                  <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  <span>{slowSubmitting ? "Activating (slow connection)..." : "Activating..."}</span>
                </>
              ) : (
                "Activate Account"
              )}
            </button>

            {!isOnline && (
              <p className="text-[11px] text-amber-600 dark:text-amber-400 text-center">
                Please reconnect to the internet to activate your account.
              </p>
            )}
          </form>
        </div>
      )}
    </>
  );
}

export default function AcceptInvitationPage() {
  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-[#09090b] flex items-center justify-center px-4 relative transition-colors duration-200">
      <div className="fixed top-4 right-4 z-50">
        <ThemeToggle variant="button" />
      </div>
      <Suspense
        fallback={
          <div className="flex items-center justify-center py-20">
            <div className="w-6 h-6 border-2 border-zinc-400 dark:border-zinc-600 border-t-blue-600 dark:border-t-zinc-300 rounded-full animate-spin" />
          </div>
        }
      >
        <AcceptInvitationForm />
      </Suspense>
    </div>
  );
}
