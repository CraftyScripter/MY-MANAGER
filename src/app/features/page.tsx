"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import ThemeToggle from "@/components/ThemeToggle";
import Footer from "@/components/Footer";

export default function FeaturesPage() {
  const [currentUser, setCurrentUser] = useState<any>(null);

  useEffect(() => {
    fetch("/api/admin/auth/me")
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (data && data.authenticated && data.user) {
          setCurrentUser(data.user);
        }
      })
      .catch(() => {});
  }, []);

  const features = [
    {
      id: "sheets-sync",
      tag: "CORE CRM ENGINE",
      title: "Google Sheets 2-Way Live Sync & Cell Merging",
      description:
        "Never perform manual CSV exports or imports again. Any lead, status update, deal value, or note edited in My Manager instantly syncs to your Google Sheet in less than 150ms — and edits made directly inside Google Sheets appear inside My Manager in real-time.",
      highlights: [
        "Bidirectional sync with zero latency spikes (<150ms)",
        "Advanced cell merging support for complex agency agency spreadsheets",
        "Formula and formatting preservation",
        "Custom column mapping with automatic type detection",
      ],
      icon: (
        <svg className="w-6 h-6 text-emerald-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 12h16.5m-16.5 3.75h16.5M3.75 19.5h16.5M5.625 4.5h12.75a1.875 1.875 0 010 3.75H5.625a1.875 1.875 0 010-3.75z" />
        </svg>
      ),
      badge: "Real-Time 2-Way",
      badgeColor: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20",
    },
    {
      id: "meet-calendar",
      tag: "CALENDLY REPLACEMENT",
      title: "Google Meet & Live Calendar Booking Engine",
      description:
        "Provide your clients with a sleek, branded scheduling link. Every booking instantly verifies your real-time Google Calendar availability, prevents double-bookings, generates a genuine Google Meet video link, and dispatches Google Calendar invitations with automatic reminders.",
      highlights: [
        "100% native Google Meet link generation (no third-party Zoom or Calendly required)",
        "Zero calendar collisions with real-time slot verification",
        "Configurable meeting durations: 15m, 30m, 45m, 60m",
        "Instant multi-tab and multi-window auto-refresh via BroadcastChannel",
      ],
      icon: (
        <svg className="w-6 h-6 text-blue-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 012.25-2.25h13.5A2.25 2.25 0 0121 7.5v11.25m-18 0A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75m-18 0v-7.5A2.25 2.25 0 015.25 9h13.5A2.25 2.25 0 0121 9v7.5" />
        </svg>
      ),
      badge: "Zero Meeting Collisions",
      badgeColor: "bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/20",
    },
    {
      id: "drive-byo",
      tag: "BYO-STORAGE ARCHITECTURE",
      title: "Zero-Markup Google Drive Storage",
      description:
        "Why pay high SaaS markups for AWS S3 cloud storage? My Manager connects directly to your own Google Drive. All invoices, client contracts, Instagram media assets, and team files stream straight into your private `MyManager_AppData` folder. You retain 100% data ownership.",
      highlights: [
        "Keep 100% ownership — your data never leaves your Google account",
        "Zero additional storage bills: leverage your existing Google Drive quota",
        "Granular folder organization: `Finance_Receipts`, `Instagram_Media`, `Team_Vault`",
        "Completely portable: access your files inside Google Drive at any time",
      ],
      icon: (
        <svg className="w-6 h-6 text-amber-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 15.75l5.159-5.159a2.25 2.25 0 013.182 0l5.159 5.159m-1.5-1.5l1.409-1.409a2.25 2.25 0 013.182 0l2.909 2.909m-18 3.75h16.5a1.5 1.5 0 001.5-1.5V6a1.5 1.5 0 00-1.5-1.5H3.75A1.5 1.5 0 002.25 6v12a1.5 1.5 0 001.5 1.5zm10.5-11.25h.008v.008h-.008V8.25zm.375 0a.375.375 0 11-.75 0 .375.375 0 01.75 0z" />
        </svg>
      ),
      badge: "100% Data Ownership",
      badgeColor: "bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20",
    },
    {
      id: "forms-mx",
      tag: "LEAD ENRICHMENT & SECURITY",
      title: "Smart Forms with Automated MX Domain Verification",
      description:
        "Stop spam leads and fake email addresses before they enter your CRM. When prospective clients submit forms or book appointments, our background engine executes automated DNS MX record lookups to verify domain deliverability and highlight high-intent enterprise prospects.",
      highlights: [
        "Instant MX record validation for prospective client domains",
        "Automatic spam and disposable email filtering",
        "Full client inquiry notes capture and pipeline status mapping",
        "Instant notifications dispatched to your admin dashboard",
      ],
      icon: (
        <svg className="w-6 h-6 text-purple-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75m-3-7.036A11.959 11.959 0 013.598 6 11.99 11.99 0 003 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285z" />
        </svg>
      ),
      badge: "DNS MX Verified",
      badgeColor: "bg-purple-500/10 text-purple-600 dark:text-purple-400 border-purple-500/20",
    },
    {
      id: "vault-rbac",
      tag: "MILITARY-GRADE SECURITY",
      title: "AES-256-GCM Encrypted Secret Vault & Granular RBAC",
      description:
        "Keep your agency's Stripe keys, Instagram tokens, OpenAI API secrets, and server credentials encrypted at rest with AES-256-GCM authenticated encryption. Assign fine-grained read/write permissions so team members only access what they need.",
      highlights: [
        "AES-256-GCM authenticated encryption with unique initialization vectors (IV)",
        "Zero plaintext keys stored in database tables",
        "Granular Role-Based Access Control (Admin, Manager, Member)",
        "Complete audit log tracking every key reveal and modification",
      ],
      icon: (
        <svg className="w-6 h-6 text-rose-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 10.5V6.75a4.5 4.5 0 10-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 002.25-2.25v-6.75a2.25 2.25 0 00-2.25-2.25H6.75a2.25 2.25 0 00-2.25 2.25v6.75a2.25 2.25 0 002.25 2.25z" />
        </svg>
      ),
      badge: "AES-256 Encrypted",
      badgeColor: "bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/20",
    },
    {
      id: "admin-centric",
      tag: "TEAM ONBOARDING ARCHITECTURE",
      title: "Admin-Centric Workspace — Single Google Connection",
      description:
        "In traditional tools, every team member must connect their Google account, creating permission nightmares and security risks. In My Manager, only the workspace Admin connects Google once. Your team members simply sign in and collaborate seamlessly without exposing their personal Google credentials.",
      highlights: [
        "Admin connects once — team members never need to link Google accounts",
        "Centralized Google Drive and Calendar authority",
        "Instant invitation via email or one-click signup",
        "Revoke team member access with a single click at any time",
      ],
      icon: (
        <svg className="w-6 h-6 text-indigo-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M18 18.72a9.094 9.094 0 003.741-.479 3 3 0 00-4.682-2.72m.94 3.198l.001.031c0 .225-.012.447-.037.666A11.944 11.944 0 0112 21c-2.17 0-4.207-.576-5.963-1.584A6.062 6.062 0 016 18.719m12 0a5.971 5.971 0 00-.941-3.197m0 0A5.995 5.995 0 0012 12.75a5.995 5.995 0 00-5.058 2.772m0 0a3 3 0 00-4.681 2.72 8.986 8.986 0 003.74.477m.999-3.199a5.971 5.971 0 00-.94 3.197M15 6.75a3 3 0 11-6 0 3 3 0 016 0zm6 3a2.25 2.25 0 11-4.5 0 2.25 2.25 0 014.5 0zm-13.5 0a2.25 2.25 0 11-4.5 0 2.25 2.25 0 014.5 0z" />
        </svg>
      ),
      badge: "1-Click Connect",
      badgeColor: "bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border-indigo-500/20",
    },
  ];

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-[#070709] text-zinc-900 dark:text-zinc-100 transition-colors duration-200">
      {/* 1. Header / Navigation */}
      <header className="sticky top-0 z-50 border-b border-zinc-200/80 dark:border-zinc-800/70 bg-white/80 dark:bg-[#070709]/80 backdrop-blur-xl">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2.5 group">
            <div className="relative">
              <img
                src="/myicon.png"
                alt="My Manager Logo"
                className="w-8 h-8 rounded-xl object-contain shadow-sm group-hover:scale-105 transition-transform duration-200"
              />
              <span className="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full bg-emerald-500 border-2 border-white dark:border-[#070709]" />
            </div>
            <div className="flex flex-col">
              <span className="font-bold text-base tracking-tight text-zinc-900 dark:text-white leading-tight">
                My Manager
              </span>
              <span className="text-[10px] text-zinc-500 font-medium tracking-wide uppercase">
                Workspace OS
              </span>
            </div>
          </Link>

          <nav className="hidden md:flex items-center gap-1 bg-zinc-100/80 dark:bg-zinc-900/60 p-1 rounded-full border border-zinc-200/60 dark:border-zinc-800/60 text-xs font-semibold text-zinc-600 dark:text-zinc-400">
            <Link href="/" className="px-3.5 py-1.5 rounded-full hover:text-zinc-900 dark:hover:text-white hover:bg-white dark:hover:bg-zinc-800/80 transition-all">
              Home
            </Link>
            <Link href="/features" className="px-3.5 py-1.5 rounded-full bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white shadow-xs font-bold transition-all">
              Features
            </Link>
            <Link href="/pricing" className="px-3.5 py-1.5 rounded-full hover:text-zinc-900 dark:hover:text-white hover:bg-white dark:hover:bg-zinc-800/80 transition-all">
              Pricing
            </Link>
            <Link href="/book" className="px-3.5 py-1.5 rounded-full text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-950/40 transition-all flex items-center gap-1.5 font-bold">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
              <span>Book Demo</span>
            </Link>
          </nav>

          <div className="flex items-center gap-2.5">
            <ThemeToggle variant="button" />
            {currentUser ? (
              <Link
                href="/admin"
                className="btn-primary px-4 py-2 rounded-xl text-xs font-bold shadow-md active:scale-97 cursor-pointer flex items-center gap-2"
              >
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                <span>Go to Workspace &rarr;</span>
              </Link>
            ) : (
              <>
                <Link
                  href="/login"
                  className="hidden sm:inline-flex px-3.5 py-1.5 rounded-xl text-xs font-semibold text-zinc-700 dark:text-zinc-300 hover:text-zinc-900 dark:hover:text-white hover:bg-zinc-100 dark:hover:bg-zinc-800 transition"
                >
                  Sign In
                </Link>
                <Link
                  href="/signup"
                  className="btn-primary px-4 py-2 rounded-xl text-xs font-bold shadow-md active:scale-97 cursor-pointer"
                >
                  Sign Up with Google
                </Link>
              </>
            )}
          </div>
        </div>
      </header>

      {/* 2. Hero Section */}
      <section className="relative pt-16 pb-14 sm:pt-24 sm:pb-20 text-center px-4 max-w-5xl mx-auto">
        <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-blue-500/10 dark:bg-blue-500/15 border border-blue-500/20 text-xs font-medium text-blue-700 dark:text-blue-300 mb-6 shadow-xs">
          <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
          <span>Full Product Feature Suite</span>
        </div>
        <h1 className="text-4xl sm:text-6xl font-extrabold tracking-tight text-zinc-900 dark:text-white leading-tight">
          Everything your agency needs, natively integrated with Google.
        </h1>
        <p className="mt-6 text-base sm:text-lg text-zinc-600 dark:text-zinc-400 max-w-3xl mx-auto leading-relaxed">
          Stop stitching together 5 different SaaS subscriptions. My Manager unifies your CRM, scheduling, cloud storage, and security credentials into a single high-performance workspace OS.
        </p>
      </section>

      {/* 3. Feature Breakdown Grid */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pb-24">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          {features.map((feature) => (
            <div
              key={feature.id}
              className="p-8 rounded-3xl bg-white dark:bg-[#111114] border border-zinc-200/90 dark:border-zinc-800/90 shadow-xl hover:shadow-2xl transition-all duration-300 flex flex-col justify-between"
            >
              <div>
                <div className="flex items-center justify-between mb-4">
                  <div className="w-12 h-12 rounded-2xl bg-zinc-100 dark:bg-zinc-800/80 border border-zinc-200 dark:border-zinc-700/60 flex items-center justify-center">
                    {feature.icon}
                  </div>
                  <span className={`px-3 py-1 rounded-full text-xs font-bold border ${feature.badgeColor}`}>
                    {feature.badge}
                  </span>
                </div>

                <div className="text-[11px] font-bold tracking-wider uppercase text-zinc-400 mb-1">
                  {feature.tag}
                </div>
                <h3 className="text-xl font-bold text-zinc-900 dark:text-white mb-3 tracking-tight">
                  {feature.title}
                </h3>
                <p className="text-sm text-zinc-600 dark:text-zinc-400 leading-relaxed mb-6">
                  {feature.description}
                </p>
              </div>

              <div className="pt-4 border-t border-zinc-100 dark:border-zinc-800/80 space-y-2">
                {feature.highlights.map((item, idx) => (
                  <div key={idx} className="flex items-center gap-2 text-xs text-zinc-700 dark:text-zinc-300">
                    <span className="w-4 h-4 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 flex items-center justify-center font-bold text-[10px] shrink-0">
                      ✓
                    </span>
                    <span>{item}</span>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* 4. Bottom CTA */}
      <section className="bg-gradient-to-b from-transparent to-blue-50/50 dark:to-blue-950/20 py-20 border-t border-zinc-200/80 dark:border-zinc-800/80 text-center px-4">
        <div className="max-w-3xl mx-auto space-y-6">
          <h2 className="text-3xl sm:text-4xl font-extrabold text-zinc-900 dark:text-white tracking-tight">
            Ready to streamline your entire agency workspace?
          </h2>
          <p className="text-sm sm:text-base text-zinc-600 dark:text-zinc-400">
            Sign up in 30 seconds with your Google account. No credit card required.
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4 pt-2">
            <Link
              href="/signup"
              className="btn-primary w-full sm:w-auto px-8 py-4 rounded-2xl text-sm font-bold shadow-xl active:scale-97 cursor-pointer"
            >
              Sign Up with Google &rarr;
            </Link>
            <Link
              href="/book"
              className="w-full sm:w-auto px-7 py-4 rounded-2xl bg-white dark:bg-[#111114] border border-zinc-200 dark:border-zinc-800 hover:bg-zinc-50 dark:hover:bg-zinc-800 text-zinc-900 dark:text-zinc-100 font-semibold text-sm transition active:scale-97 cursor-pointer"
            >
              Book Live Strategy Demo →
            </Link>
          </div>
        </div>
      </section>

      {/* 5. Footer */}
      <Footer />
    </div>
  );
}
