"use client";

import { Suspense, useEffect, useState } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import Link from "next/link";
import ThemeToggle from "@/components/ThemeToggle";

function getFirstPermittedPath(permissions: string[]): string {
  const sectionOrder = [
    { perm: "dashboard", path: "/admin" },
    { perm: "leads", path: "/admin/leads" },
    { perm: "calendar", path: "/admin/calendar" },
    { perm: "forms", path: "/admin/promise-me" },
    { perm: "finance", path: "/admin/payments" },
    { perm: "credentials", path: "/admin/credentials" },
    { perm: "env", path: "/admin/env" },
    { perm: "settings", path: "/admin/settings" },
  ];
  for (const section of sectionOrder) {
    if (permissions.includes(section.perm)) return section.path;
  }
  return "/admin";
}

function LoginForm() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const from = searchParams.get("from") || null;

  useEffect(() => {
    fetch("/api/admin/auth/me").then((r) => {
      if (r.ok) {
        r.json().then((data) => {
          if (data.authenticated && data.user) {
            if (data.user.role === "admin") {
              router.replace(from || "/admin");
            } else {
              const target = from || getFirstPermittedPath(data.user.permissions || []);
              router.replace(target);
            }
          }
        });
      }
    });
  }, [from, router]);

  const [loginMode, setLoginMode] = useState<"google" | "email">("google");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);

  // Workspace selector state
  const [needsWorkspaceSelection, setNeedsWorkspaceSelection] = useState(false);
  const [workspaces, setWorkspaces] = useState<Array<{
    workspaceId: string;
    workspaceName: string;
    workspaceEmail: string;
    role: string;
    permissions: string[];
  }>>([]);
  const [selectedWorkspace, setSelectedWorkspace] = useState<string | null>(null);

  // Reset loading when user returns to this page (e.g. after cancelling Google OAuth)
  useEffect(() => {
    const handleVisibility = () => {
      if (document.visibilityState === "visible") setLoading(false);
    };
    document.addEventListener("visibilitychange", handleVisibility);
    window.addEventListener("focus", () => setLoading(false));
    return () => {
      document.removeEventListener("visibilitychange", handleVisibility);
      window.removeEventListener("focus", () => setLoading(false));
    };
  }, []);

  const handleGoogleLogin = async () => {
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/admin/google/auth/url?state=login");
      const data = await res.json();
      if (data.authUrl) {
        window.location.href = data.authUrl;
      } else {
        setError("Unable to sign in with Google at the moment. Please try again later.");
        setLoading(false);
      }
    } catch {
      setError("Failed to connect to Google OAuth service");
      setLoading(false);
    }
  };

  const handleEmailLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");

    if (!email || !password) {
      setError("Email and password are required");
      setLoading(false);
      return;
    }

    try {
      const res = await fetch("/api/admin/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username: email, password }),
      });

      const data = await res.json();

      // If workspace selection is needed
      if (data.requiresWorkspaceSelection) {
        setWorkspaces(data.workspaces);
        setNeedsWorkspaceSelection(true);
        setLoading(false);
        return;
      }

      if (!res.ok) {
        setError("Unable to sign in. Please check your credentials and try again.");
        setLoading(false);
        return;
      }

      // Success — redirect based on role
      if (data.role === "admin") {
        router.replace(from || "/admin");
      } else {
        const target = from || getFirstPermittedPath(data.permissions || []);
        router.replace(target);
      }
    } catch {
      setError("Failed to connect to server");
      setLoading(false);
    }
  };

  const handleWorkspaceLogin = async (workspaceId: string) => {
    setLoading(true);
    setError("");
    setSelectedWorkspace(workspaceId);

    try {
      const res = await fetch("/api/admin/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username: email, password, workspaceId }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || "Failed to sign in to this workspace");
        setLoading(false);
        setSelectedWorkspace(null);
        return;
      }

      // Success — redirect to permitted section
      const target = from || getFirstPermittedPath(data.permissions || []);
      router.replace(target);
    } catch {
      setError("Failed to connect to server");
      setLoading(false);
      setSelectedWorkspace(null);
    }
  };

  return (
    <div className="w-full max-w-md bg-white dark:bg-[#111114] border border-zinc-200 dark:border-zinc-800 p-8 md:p-10 rounded-3xl shadow-2xl transition-colors duration-200 space-y-6">
      <div className="text-center space-y-2">
        <Link href="/" className="inline-block hover:scale-105 transition-transform">
          <img
            src="/myicon.png"
            alt="My Manager Logo"
            className="w-14 h-14 rounded-2xl mx-auto mb-2 shadow-md object-contain"
          />
        </Link>
        <h1 className="text-2xl font-extrabold text-zinc-900 dark:text-white tracking-tight">
          Welcome to My Manager
        </h1>
        <p className="text-zinc-500 text-xs">
          {loginMode === "google"
            ? "Sign in with your Google account to access your workspace"
            : "Sign in with your email and password"}
        </p>
      </div>

      {error && (
        <div className="bg-red-500/10 border border-red-500/20 text-red-600 dark:text-red-400 text-xs px-3.5 py-2.5 rounded-xl font-medium">
          {error}
        </div>
      )}

      {/* Workspace Selector */}
      {needsWorkspaceSelection && (
        <div className="space-y-3">
          <div className="p-3 rounded-xl bg-blue-50 dark:bg-blue-500/10 border border-blue-200 dark:border-blue-500/20">
            <p className="text-xs text-blue-700 dark:text-blue-300 font-medium text-center">
              Select a workspace to sign in to:
            </p>
          </div>
          {workspaces.map((ws) => (
            <button
              key={ws.workspaceId}
              onClick={() => handleWorkspaceLogin(ws.workspaceId)}
              disabled={loading}
              className={`w-full p-4 rounded-xl border text-left transition-all cursor-pointer ${
                selectedWorkspace === ws.workspaceId
                  ? "bg-blue-50 dark:bg-blue-500/10 border-blue-400 dark:border-blue-500/40"
                  : "bg-zinc-50 dark:bg-zinc-900/60 border-zinc-200 dark:border-zinc-800 hover:border-blue-300 dark:hover:border-blue-500/30"
              }`}
            >
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-600 to-indigo-600 flex items-center justify-center text-sm font-bold text-white shadow-md shrink-0">
                  {ws.workspaceName?.charAt(0)?.toUpperCase() || "W"}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-zinc-900 dark:text-white truncate">
                    {ws.workspaceName}
                  </p>
                  <p className="text-[11px] text-zinc-500 dark:text-zinc-400 truncate">
                    {ws.workspaceEmail} &middot; {ws.role}
                  </p>
                </div>
                {selectedWorkspace === ws.workspaceId && loading && (
                  <div className="w-4 h-4 border-2 border-blue-400 border-t-transparent rounded-full animate-spin" />
                )}
              </div>
            </button>
          ))}
          <button
            type="button"
            onClick={() => { setNeedsWorkspaceSelection(false); setWorkspaces([]); setSelectedWorkspace(null); setError(""); }}
            className="w-full py-2 text-xs font-medium text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300 transition"
          >
            &larr; Back to login
          </button>
        </div>
      )}

      {/* Mode Toggle (hidden when workspace selector is shown) */}
      {!needsWorkspaceSelection && (<>
      <div className="flex bg-zinc-100 dark:bg-zinc-900/60 p-1 rounded-xl border border-zinc-200 dark:border-zinc-800">
        <button
          type="button"
          onClick={() => { setLoginMode("google"); setError(""); }}
          className={`flex-1 py-2 text-xs font-semibold rounded-lg transition cursor-pointer ${
            loginMode === "google"
              ? "bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white shadow-sm"
              : "text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300"
          }`}
        >
          Google Sign In
        </button>
        <button
          type="button"
          onClick={() => { setLoginMode("email"); setError(""); }}
          className={`flex-1 py-2 text-xs font-semibold rounded-lg transition cursor-pointer ${
            loginMode === "email"
              ? "bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white shadow-sm"
              : "text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300"
          }`}
        >
          Email & Password
        </button>
      </div>

      {/* Google Sign In */}
      {loginMode === "google" && (
        <>
          <div className="p-4 rounded-2xl bg-zinc-50 dark:bg-zinc-900/60 border border-zinc-200 dark:border-zinc-800 space-y-2">
            <div className="flex items-center gap-2 text-xs font-semibold text-zinc-800 dark:text-zinc-200">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
              <span>Google Workspace Integrated</span>
            </div>
            <p className="text-[11px] text-zinc-500 dark:text-zinc-400 leading-relaxed">
              Your files, meetings, and CRM sheets are directly synced to your Google Drive and Google Calendar.
            </p>
          </div>

          <button
            type="button"
            onClick={handleGoogleLogin}
            disabled={loading}
            className="w-full py-3.5 px-5 bg-white dark:bg-[#18181b] hover:bg-zinc-100 dark:hover:bg-zinc-800 border border-zinc-300 dark:border-zinc-700 rounded-2xl text-xs font-bold text-zinc-900 dark:text-white flex items-center justify-center gap-3 transition shadow-lg cursor-pointer active:scale-97 disabled:opacity-50"
          >
            {loading ? (
              <div className="w-5 h-5 border-2 border-zinc-400 border-t-zinc-700 dark:border-t-white rounded-full animate-spin" />
            ) : (
              <svg className="w-5 h-5" viewBox="0 0 24 24">
                <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z" />
                <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z" />
              </svg>
            )}
            <span>{loading ? "Connecting to Google..." : "Sign In with Google"}</span>
          </button>
        </>
      )}

      {/* Email & Password Login */}
      {loginMode === "email" && (
        <form onSubmit={handleEmailLogin} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-zinc-600 dark:text-zinc-400 mb-1.5">
              Email Address
            </label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              disabled={loading}
              required
              autoFocus
              className="w-full bg-slate-50 dark:bg-zinc-900/90 border border-zinc-200 dark:border-zinc-800 rounded-xl px-3.5 py-2.5 text-sm text-zinc-900 dark:text-white placeholder:text-zinc-400 dark:placeholder:text-zinc-600 focus:outline-none focus:ring-2 focus:ring-blue-500 transition disabled:opacity-50"
              placeholder="your@email.com"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-zinc-600 dark:text-zinc-400 mb-1.5">
              Password
            </label>
            <div className="relative">
              <input
                type={showPassword ? "text" : "password"}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                disabled={loading}
                required
                className="w-full bg-slate-50 dark:bg-zinc-900/90 border border-zinc-200 dark:border-zinc-800 rounded-xl pl-3.5 pr-10 py-2.5 text-sm text-zinc-900 dark:text-white placeholder:text-zinc-400 dark:placeholder:text-zinc-600 focus:outline-none focus:ring-2 focus:ring-blue-500 transition disabled:opacity-50"
                placeholder="Enter your password"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                tabIndex={-1}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300 p-0.5 transition"
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

          <button
            type="submit"
            disabled={loading}
            className="w-full py-3 px-5 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 rounded-2xl text-xs font-bold text-white flex items-center justify-center gap-3 transition shadow-lg cursor-pointer active:scale-97"
          >
            {loading ? (
              <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
            ) : (
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 9V5.25A2.25 2.25 0 0013.5 3h-6a2.25 2.25 0 00-2.25 2.25v13.5A2.25 2.25 0 007.5 21h6a2.25 2.25 0 002.25-2.25V15m3 0l3-3m0 0l-3-3m3 3H9" />
              </svg>
            )}
            <span>{loading ? "Signing In..." : "Sign In"}</span>
          </button>

          <div className="p-3 rounded-xl bg-zinc-50 dark:bg-zinc-900/60 border border-zinc-200 dark:border-zinc-800">
            <p className="text-[11px] text-zinc-500 dark:text-zinc-400 leading-relaxed text-center">
              Team member? Use the email and password from your invitation email.
              <br />
              <Link href="/accept-invitation" className="text-blue-500 font-semibold hover:underline">
                Need to set your password? &rarr;
              </Link>
            </p>
          </div>
        </form>
      )}
      </>)}

      <div className="pt-2 text-center text-xs text-zinc-500 border-t border-zinc-200 dark:border-zinc-800">
        New to My Manager?{" "}
        <Link href="/signup" className="text-blue-500 font-semibold hover:underline">
          Sign Up with Google &rarr;
        </Link>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <div className="min-h-screen bg-slate-50 dark:bg-[#09090b] flex flex-col justify-between p-4 relative transition-colors duration-200">
      <div className="flex items-center justify-between max-w-7xl mx-auto w-full py-2">
        <Link href="/" className="flex items-center gap-2">
          <img src="/myicon.png" alt="My Manager Logo" className="w-8 h-8 rounded-xl object-contain" />
          <span className="font-bold text-sm text-zinc-900 dark:text-white">My Manager</span>
        </Link>
        <ThemeToggle variant="button" />
      </div>

      <div className="flex items-center justify-center py-10">
        <Suspense
          fallback={
            <div className="flex items-center justify-center py-20">
              <div className="w-6 h-6 border-2 border-zinc-600 border-t-zinc-300 rounded-full animate-spin" />
            </div>
          }
        >
          <LoginForm />
        </Suspense>
      </div>

      <footer className="py-4 text-center text-xs text-zinc-500">
        &copy; {new Date().getFullYear()} My Manager SaaS. All rights reserved.
      </footer>
    </div>
  );
}
