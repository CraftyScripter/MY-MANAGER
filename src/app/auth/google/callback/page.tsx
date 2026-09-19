"use client";

import { useEffect, useState, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";

function GoogleCallbackContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const [status, setStatus] = useState<"loading" | "success" | "error">("loading");
  const [errorMessage, setErrorMessage] = useState<string>("");

  useEffect(() => {
    const code = searchParams.get("code");
    const error = searchParams.get("error");
    const state = searchParams.get("state");

    if (error) {
      setStatus("error");
      setErrorMessage(error === "access_denied" ? "Google Access was denied by user." : error);
      return;
    }

    if (!code) {
      setStatus("error");
      setErrorMessage("No authorization code found in Google response.");
      return;
    }

    async function processAuth() {
      try {
        const res = await fetch("/api/admin/google/auth/callback", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ code, state }),
        });

        const data = await res.json();
        if (!res.ok || !data.success) {
          throw new Error(data.error || "Failed to link Google account");
        }

        setStatus("success");

        // If in a popup, message opener and close
        if (window.opener && !window.opener.closed) {
          try {
            window.opener.postMessage({ type: "GOOGLE_AUTH_SUCCESS", data }, window.location.origin);
            setTimeout(() => window.close(), 1200);
            return;
          } catch (_) {}
        }

        // Direct navigation redirect
        setTimeout(() => {
          router.push("/admin");
        }, 1000);
      } catch (err: any) {
        setStatus("error");
        setErrorMessage(err?.message || "Something went wrong during Google authorization.");
      }
    }


    processAuth();
  }, [searchParams, router]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-zinc-950 text-zinc-100 p-4 font-sans">
      <div className="w-full max-w-md bg-zinc-900/90 border border-zinc-800/80 rounded-2xl p-8 shadow-2xl backdrop-blur-xl text-center">
        {status === "loading" && (
          <div className="flex flex-col items-center gap-4">
            <div className="relative">
              <div className="w-14 h-14 rounded-2xl bg-indigo-500/10 border border-indigo-500/30 flex items-center justify-center text-indigo-400">
                <svg className="w-7 h-7 animate-spin" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
                </svg>
              </div>
            </div>
            <h2 className="text-xl font-semibold text-zinc-100">Connecting Google Account</h2>
            <p className="text-sm text-zinc-400">
              Configuring Google Drive BYO-Storage (MyManager_AppData) &amp; Google Sheets sync permissions...
            </p>
          </div>
        )}

        {status === "success" && (
          <div className="flex flex-col items-center gap-4">
            <div className="w-14 h-14 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-400">
              <svg className="w-7 h-7" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
              </svg>
            </div>
            <h2 className="text-xl font-semibold text-zinc-100">Connected Successfully!</h2>
            <p className="text-sm text-zinc-400">
              Google Drive and Sheets access linked. Redirecting to your dashboard...
            </p>
          </div>
        )}

        {status === "error" && (
          <div className="flex flex-col items-center gap-4">
            <div className="w-14 h-14 rounded-2xl bg-rose-500/10 border border-rose-500/30 flex items-center justify-center text-rose-400">
              <svg className="w-7 h-7" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z" />
              </svg>
            </div>
            <h2 className="text-xl font-semibold text-zinc-100">Authentication Failed</h2>
            <p className="text-sm text-rose-400/90 bg-rose-950/40 border border-rose-900/50 rounded-lg p-3 w-full text-left font-mono text-xs break-all">
              {errorMessage}
            </p>
            <button
              onClick={() => router.push("/admin/leads")}
              className="mt-2 w-full py-2.5 px-4 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-200 text-sm font-medium transition-colors cursor-pointer"
            >
              Return to Leads
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

export default function GoogleCallbackPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center bg-zinc-950 text-zinc-100">
          <div className="w-8 h-8 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" />
        </div>
      }
    >
      <GoogleCallbackContent />
    </Suspense>
  );
}
