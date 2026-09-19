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

  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleGoogleLogin = async () => {
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/admin/google/auth/url?state=login");
      const data = await res.json();
      if (data.authUrl) {
        window.location.href = data.authUrl;
      } else {
        setError(data.error || "Google Sign In is currently unavailable");
        setLoading(false);
      }
    } catch {
      setError("Failed to connect to Google OAuth service");
      setLoading(false);
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
          Sign in with your Google account to access your workspace
        </p>
      </div>

      {error && (
        <div className="bg-red-500/10 border border-red-500/20 text-red-600 dark:text-red-400 text-xs px-3.5 py-2.5 rounded-xl font-medium">
          {error}
        </div>
      )}

      {/* Info card */}
      <div className="p-4 rounded-2xl bg-zinc-50 dark:bg-zinc-900/60 border border-zinc-200 dark:border-zinc-800 space-y-2">
        <div className="flex items-center gap-2 text-xs font-semibold text-zinc-800 dark:text-zinc-200">
          <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
          <span>Google Workspace Integrated</span>
        </div>
        <p className="text-[11px] text-zinc-500 dark:text-zinc-400 leading-relaxed">
          Your files, meetings, and CRM sheets are directly synced to your Google Drive and Google Calendar.
        </p>
      </div>

      {/* Single Google Sign In Action */}
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
            <path
              fill="#4285F4"
              d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
            />
            <path
              fill="#34A853"
              d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
            />
            <path
              fill="#FBBC05"
              d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
            />
            <path
              fill="#EA4335"
              d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
            />
          </svg>
        )}
        <span>{loading ? "Connecting to Google..." : "Sign In with Google"}</span>
      </button>

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
        © {new Date().getFullYear()} My Manager SaaS. All rights reserved.
      </footer>
    </div>
  );
}
