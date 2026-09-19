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

  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      const res = await fetch("/api/admin/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError("Invalid username or password");
        setLoading(false);
        return;
      }

      if (from) {
        window.location.href = from;
      } else if (data.role && data.permissions) {
        if (data.role === "admin") {
          window.location.href = "/admin";
        } else {
          window.location.href = getFirstPermittedPath(data.permissions);
        }
      } else {
        window.location.href = "/admin";
      }
    } catch {
      setError("Something went wrong");
      setLoading(false);
    }
  }

  return (
    <div className="w-full max-w-sm bg-white dark:bg-[#111114] border border-zinc-200 dark:border-zinc-800 p-8 rounded-3xl shadow-2xl transition-colors duration-200">
      <div className="text-center mb-6">
        <Link href="/" className="inline-block">
          <img
            src="/myicon.png"
            alt="My Manager Logo"
            className="w-12 h-12 rounded-2xl mx-auto mb-3 shadow-md object-contain"
          />
        </Link>
        <h1 className="text-2xl font-bold text-zinc-900 dark:text-white tracking-tight">Welcome Back</h1>
        <p className="text-zinc-500 text-xs mt-1">Sign in to your My Manager workspace</p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        {error && (
          <div className="bg-red-500/10 border border-red-500/20 text-red-600 dark:text-red-400 text-xs px-3.5 py-2.5 rounded-xl font-medium">
            {error}
          </div>
        )}

        <div>
          <label className="block text-xs font-semibold text-zinc-600 dark:text-zinc-400 mb-1.5">Email</label>
          <input
            type="email"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            required
            autoFocus
            className="w-full bg-zinc-50 dark:bg-zinc-900/90 border border-zinc-200 dark:border-zinc-800 rounded-xl px-3.5 py-2.5 text-sm text-zinc-900 dark:text-white placeholder:text-zinc-400 dark:placeholder:text-zinc-600 focus:outline-none focus:ring-2 focus:ring-blue-500 transition"
            placeholder="admin@mymanager.com"
          />
        </div>

        <div>
          <label className="block text-xs font-semibold text-zinc-600 dark:text-zinc-400 mb-1.5">Password</label>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            className="w-full bg-zinc-50 dark:bg-zinc-900/90 border border-zinc-200 dark:border-zinc-800 rounded-xl px-3.5 py-2.5 text-sm text-zinc-900 dark:text-white placeholder:text-zinc-400 dark:placeholder:text-zinc-600 focus:outline-none focus:ring-2 focus:ring-blue-500 transition"
            placeholder="••••••••"
          />
        </div>

        <button
          type="submit"
          disabled={loading}
          className="btn-primary w-full py-2.5 text-sm disabled:opacity-40 disabled:cursor-not-allowed shadow-md mt-2 cursor-pointer"
        >
          {loading ? "Signing in..." : "Sign In to Workspace"}
        </button>

        <div className="relative my-4">
          <div className="absolute inset-0 flex items-center">
            <div className="w-full border-t border-zinc-200 dark:border-zinc-800" />
          </div>
          <div className="relative flex justify-center text-[10px] uppercase">
            <span className="bg-white dark:bg-[#111114] px-2 text-zinc-400 font-medium">Or continue with</span>
          </div>
        </div>

        <button
          type="button"
          onClick={async () => {
            try {
              const res = await fetch("/api/admin/google/auth/url?state=login");
              const data = await res.json();
              if (data.authUrl) {
                window.location.href = data.authUrl;
              } else {
                setError(data.error || "Google Login unavailable");
              }
            } catch {
              setError("Failed to initialize Google Login");
            }
          }}
          className="w-full py-2.5 px-4 bg-zinc-100 hover:bg-zinc-200 dark:bg-zinc-800/80 dark:hover:bg-zinc-800 border border-zinc-200 dark:border-zinc-700/80 rounded-xl text-xs font-semibold text-zinc-800 dark:text-zinc-200 flex items-center justify-center gap-2.5 transition cursor-pointer"
        >
          <svg className="w-4 h-4" viewBox="0 0 24 24">
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
          <span>Sign In with Google</span>
        </button>
      </form>

      <div className="mt-6 text-center text-xs text-zinc-500">
        Don't have an admin workspace?{" "}
        <Link href="/signup" className="text-blue-500 font-semibold hover:underline">
          Get Started &rarr;
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
