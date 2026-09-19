"use client";

import { useState } from "react";
import Link from "next/link";
import ThemeToggle from "@/components/ThemeToggle";

export default function SignupPage() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleGoogleSignup = async () => {
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/admin/google/auth/url?state=signup");
      const data = await res.json();
      if (data.authUrl) {
        window.location.href = data.authUrl;
      } else {
        setError(data.error || "Failed to initialize Google Onboarding");
        setLoading(false);
      }
    } catch {
      setError("Network connection error. Please try again.");
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-[#09090b] flex flex-col justify-between p-4 relative transition-colors duration-200">
      {/* Top Header */}
      <div className="flex items-center justify-between max-w-7xl mx-auto w-full py-2">
        <Link href="/" className="flex items-center gap-2">
          <img src="/myicon.png" alt="My Manager Logo" className="w-8 h-8 rounded-xl object-contain" />
          <span className="font-bold text-sm text-zinc-900 dark:text-white">My Manager</span>
        </Link>
        <div className="flex items-center gap-3">
          <ThemeToggle variant="button" />
          <Link
            href="/login"
            className="px-3.5 py-1.5 rounded-xl text-xs font-semibold text-zinc-700 dark:text-zinc-300 hover:text-zinc-900 dark:hover:text-white transition"
          >
            Sign In
          </Link>
        </div>
      </div>

      {/* Main Card */}
      <div className="flex items-center justify-center py-8">
        <div className="w-full max-w-md bg-white dark:bg-[#111114] border border-zinc-200 dark:border-zinc-800 p-8 md:p-10 rounded-3xl shadow-2xl space-y-6">
          <div className="text-center space-y-2">
            <div className="w-14 h-14 rounded-2xl bg-blue-600/10 border border-blue-500/20 text-blue-500 flex items-center justify-center mx-auto shadow-inner">
              <svg className="w-7 h-7" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 21a9.004 9.004 0 008.716-6.747M12 21a9.004 9.004 0 01-8.716-6.747M12 21c2.485 0 4.5-4.03 4.5-9S14.485 3 12 3m0 18c-2.485 0-4.5-4.03-4.5-9S9.515 3 12 3m0 0a8.997 8.997 0 017.843 4.582M12 3a8.997 8.997 0 00-7.843 4.582m15.686 0A11.953 11.953 0 0112 10.5c-2.998 0-5.74-1.1-7.843-2.918m15.686 0A8.959 8.959 0 0121 12c0 .778-.099 1.533-.284 2.253m0 0A17.919 17.919 0 0112 16.5c-3.162 0-6.133-.815-8.716-2.247m0 0A9.015 9.015 0 013 12c0-1.605.42-3.113 1.157-4.418" />
              </svg>
            </div>
            <h1 className="text-2xl font-bold text-zinc-900 dark:text-white tracking-tight">
              Create Admin Workspace
            </h1>
            <p className="text-xs text-zinc-500">
              One-click Google integration for your entire team's Drive, Calendar & Sheets
            </p>
          </div>

          {error && (
            <div className="bg-red-500/10 border border-red-500/20 text-red-600 dark:text-red-400 text-xs px-3.5 py-2.5 rounded-xl font-medium">
              {error}
            </div>
          )}

          {/* Architecture Benefits Highlight */}
          <div className="p-4 rounded-2xl bg-zinc-50 dark:bg-zinc-900/60 border border-zinc-200 dark:border-zinc-800 space-y-2.5">
            <div className="text-xs font-semibold text-zinc-800 dark:text-zinc-200 flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
              <span>Admin-Centric Workspace Benefits</span>
            </div>
            <ul className="text-[11px] text-zinc-600 dark:text-zinc-400 space-y-1.5 pl-4 list-disc">
              <li>You connect once — team members do NOT connect Google accounts.</li>
              <li>Team file uploads stream automatically into your Google Drive (`MyManager_AppData`).</li>
              <li>Bookings create instant Google Meet events on your primary calendar.</li>
              <li>2-Way live CRM sync with your Google Sheets.</li>
            </ul>
          </div>

          {/* Primary CTA */}
          <button
            onClick={handleGoogleSignup}
            disabled={loading}
            className="w-full py-3.5 px-4 bg-white dark:bg-[#18181b] hover:bg-zinc-100 dark:hover:bg-zinc-800 border border-zinc-300 dark:border-zinc-700 rounded-2xl text-xs font-bold text-zinc-900 dark:text-white flex items-center justify-center gap-3 transition shadow-lg cursor-pointer active:scale-97 disabled:opacity-50"
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
            <span>{loading ? "Redirecting to Google..." : "Continue with Google (Admin Onboarding)"}</span>
          </button>

          <p className="text-[11px] text-center text-zinc-500">
            By signing up, you agree to grant Drive, Calendar & Sheets permissions for workspace sync.
          </p>

          <div className="pt-2 text-center text-xs text-zinc-500 border-t border-zinc-200 dark:border-zinc-800">
            Already have a workspace?{" "}
            <Link href="/login" className="text-blue-500 font-semibold hover:underline">
              Sign In &rarr;
            </Link>
          </div>
        </div>
      </div>

      {/* Footer */}
      <footer className="py-4 text-center text-xs text-zinc-500">
        © {new Date().getFullYear()} My Manager SaaS. All rights reserved.
      </footer>
    </div>
  );
}
