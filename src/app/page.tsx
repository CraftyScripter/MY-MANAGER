"use client";

import { useState } from "react";
import Link from "next/link";
import ThemeToggle from "@/components/ThemeToggle";

export default function SaaSMarketingLandingPage() {
  const [activeTab, setActiveTab] = useState<"leads" | "calendar" | "drive" | "vault">("leads");
  const [billingPeriod, setBillingPeriod] = useState<"monthly" | "yearly">("yearly");
  const [selectedSlot, setSelectedSlot] = useState<string>("today-2pm");
  const [revealedVaultKey, setRevealedVaultKey] = useState<boolean>(false);
  const [copiedKey, setCopiedKey] = useState<boolean>(false);
  const [leadStatusFilter, setLeadStatusFilter] = useState<string>("all");

  const handleCopyKey = () => {
    setCopiedKey(true);
    setTimeout(() => setCopiedKey(false), 2000);
  };

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-[#070709] text-zinc-900 dark:text-zinc-100 transition-colors duration-200 selection:bg-blue-600 selection:text-white">
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
            <a href="#features" className="px-3.5 py-1.5 rounded-full hover:text-zinc-900 dark:hover:text-white hover:bg-white dark:hover:bg-zinc-800/80 transition-all">
              Features
            </a>
            <a href="#architecture" className="px-3.5 py-1.5 rounded-full hover:text-zinc-900 dark:hover:text-white hover:bg-white dark:hover:bg-zinc-800/80 transition-all">
              Why Admin-Centric
            </a>
            <a href="#preview" className="px-3.5 py-1.5 rounded-full hover:text-zinc-900 dark:hover:text-white hover:bg-white dark:hover:bg-zinc-800/80 transition-all">
              Live Preview
            </a>
            <a href="#pricing" className="px-3.5 py-1.5 rounded-full hover:text-zinc-900 dark:hover:text-white hover:bg-white dark:hover:bg-zinc-800/80 transition-all">
              Pricing
            </a>
            <Link href="/book" className="px-3.5 py-1.5 rounded-full text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-950/40 transition-all flex items-center gap-1.5 font-bold">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
              <span>Book Demo</span>
            </Link>
          </nav>

          <div className="flex items-center gap-2.5">
            <ThemeToggle variant="button" />
            <Link
              href="/login"
              className="hidden sm:inline-flex px-3.5 py-1.5 rounded-xl text-xs font-semibold text-zinc-700 dark:text-zinc-300 hover:text-zinc-900 dark:hover:text-white hover:bg-zinc-100 dark:hover:bg-zinc-800 transition"
            >
              Sign In
            </Link>
            <Link
              href="/signup"
              className="btn-primary px-4 py-2 rounded-xl text-xs font-semibold shadow-md active:scale-97 cursor-pointer"
            >
              Get Started Free
            </Link>
          </div>
        </div>
      </header>

      {/* 2. Hero Section */}
      <section className="relative pt-16 pb-20 sm:pt-24 sm:pb-28 overflow-hidden">
        {/* Ambient background glows */}
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[800px] h-[400px] bg-gradient-to-b from-blue-600/15 via-indigo-500/10 to-transparent blur-[120px] rounded-full pointer-events-none -z-10" />
        <div className="absolute top-1/4 -left-40 w-[350px] h-[350px] bg-emerald-500/10 blur-[120px] rounded-full pointer-events-none -z-10" />
        <div className="absolute top-1/3 -right-40 w-[350px] h-[350px] bg-purple-500/10 blur-[120px] rounded-full pointer-events-none -z-10" />

        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center relative z-10">
          {/* Eyebrow badge */}
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-blue-500/10 dark:bg-blue-500/15 border border-blue-500/20 text-xs font-medium text-blue-700 dark:text-blue-300 mb-8 shadow-xs">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
            <span className="font-bold">New Release v2.4</span>
            <span className="text-blue-400/60">•</span>
            <span>Google Sheets 2-Way Sync & Cell Merge</span>
            <span className="text-blue-600 dark:text-blue-400 font-bold ml-1">→</span>
          </div>

          {/* Main Headline */}
          <h1 className="text-4xl sm:text-6xl lg:text-7xl font-extrabold tracking-tight text-zinc-900 dark:text-white max-w-5xl mx-auto leading-[1.08]">
            The Unified Workspace for Modern Teams & Digital Agencies.
          </h1>

          {/* Subtitle */}
          <p className="mt-6 text-base sm:text-lg text-zinc-600 dark:text-zinc-400 max-w-3xl mx-auto leading-relaxed">
            Eliminate SaaS sprawl. Keep 100% data ownership in your own{" "}
            <span className="text-zinc-900 dark:text-white font-semibold">Google Drive</span>, sync leads seamlessly with{" "}
            <span className="text-zinc-900 dark:text-white font-semibold">Google Sheets</span>, and schedule clients with instant{" "}
            <span className="text-zinc-900 dark:text-white font-semibold">Google Meet</span> video links.
          </p>

          {/* CTA Buttons */}
          <div className="mt-10 flex flex-col sm:flex-row items-center justify-center gap-4 max-w-md mx-auto sm:max-w-none">
            <Link
              href="/signup"
              className="w-full sm:w-auto px-7 py-3.5 rounded-2xl bg-zinc-900 text-white dark:bg-white dark:text-zinc-900 hover:bg-zinc-800 dark:hover:bg-zinc-100 font-bold text-sm shadow-xl transition-all active:scale-97 cursor-pointer flex items-center justify-center gap-2.5 hover:shadow-blue-500/10"
            >
              <svg className="w-4 h-4 shrink-0" viewBox="0 0 24 24">
                <path
                  fill="currentColor"
                  d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                />
                <path
                  fill="currentColor"
                  d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                />
                <path
                  fill="currentColor"
                  d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
                />
                <path
                  fill="currentColor"
                  d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
                />
              </svg>
              <span>Get Started with Google</span>
            </Link>

            <Link
              href="/book"
              className="w-full sm:w-auto px-6 py-3.5 rounded-2xl bg-white dark:bg-[#111114] border border-zinc-200 dark:border-zinc-800 hover:bg-zinc-50 dark:hover:bg-zinc-800/80 text-zinc-900 dark:text-zinc-100 font-semibold text-sm shadow-xs transition-all active:scale-97 cursor-pointer flex items-center justify-center gap-2"
            >
              <svg className="w-4 h-4 text-emerald-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 012.25-2.25h13.5A2.25 2.25 0 0121 7.5v11.25m-18 0A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75m-18 0v-7.5A2.25 2.25 0 015.25 9h13.5A2.25 2.25 0 0121 9v7.5" />
              </svg>
              <span>Try Live Calendar Booking →</span>
            </Link>
          </div>

          {/* Value props trust row */}
          <div className="mt-10 pt-6 border-t border-zinc-200/60 dark:border-zinc-800/60 max-w-3xl mx-auto flex flex-wrap items-center justify-center gap-6 sm:gap-10 text-xs text-zinc-600 dark:text-zinc-400 font-medium">
            <div className="flex items-center gap-2">
              <span className="w-5 h-5 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 flex items-center justify-center font-bold text-xs">✓</span>
              <span>100% Data Ownership (Your Drive)</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="w-5 h-5 rounded-full bg-blue-500/10 text-blue-600 dark:text-blue-400 flex items-center justify-center font-bold text-xs">✓</span>
              <span>Zero Extra Storage Bills</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="w-5 h-5 rounded-full bg-purple-500/10 text-purple-600 dark:text-purple-400 flex items-center justify-center font-bold text-xs">✓</span>
              <span>AES-256 Military Encryption</span>
            </div>
          </div>

          {/* 3. Interactive Live Workspace Preview Card */}
          <div id="preview" className="mt-14 max-w-5xl mx-auto rounded-3xl bg-white dark:bg-[#111114] border border-zinc-200/90 dark:border-zinc-800 shadow-2xl overflow-hidden text-left transition-all duration-300">
            {/* Window title bar */}
            <div className="px-5 py-3.5 border-b border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900/70 flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full bg-rose-500/80" />
                <div className="w-3 h-3 rounded-full bg-amber-500/80" />
                <div className="w-3 h-3 rounded-full bg-emerald-500/80" />
                <span className="text-xs font-semibold text-zinc-600 dark:text-zinc-300 ml-3 flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                  My Manager Workspace — Live Interactive Demo
                </span>
              </div>

              {/* Module switcher tabs */}
              <div className="flex items-center gap-1 bg-zinc-200/60 dark:bg-zinc-800/80 p-1 rounded-xl text-xs font-semibold">
                <button
                  onClick={() => setActiveTab("leads")}
                  className={`px-3 py-1 rounded-lg transition cursor-pointer flex items-center gap-1.5 ${
                    activeTab === "leads"
                      ? "bg-white dark:bg-zinc-900 text-zinc-900 dark:text-white shadow-xs font-bold"
                      : "text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white"
                  }`}
                >
                  <span>📊</span>
                  <span>Leads & CRM</span>
                </button>
                <button
                  onClick={() => setActiveTab("calendar")}
                  className={`px-3 py-1 rounded-lg transition cursor-pointer flex items-center gap-1.5 ${
                    activeTab === "calendar"
                      ? "bg-white dark:bg-zinc-900 text-zinc-900 dark:text-white shadow-xs font-bold"
                      : "text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white"
                  }`}
                >
                  <span>📅</span>
                  <span>Calendar & Meet</span>
                </button>
                <button
                  onClick={() => setActiveTab("drive")}
                  className={`px-3 py-1 rounded-lg transition cursor-pointer flex items-center gap-1.5 ${
                    activeTab === "drive"
                      ? "bg-white dark:bg-zinc-900 text-zinc-900 dark:text-white shadow-xs font-bold"
                      : "text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white"
                  }`}
                >
                  <span>☁️</span>
                  <span>Drive BYO</span>
                </button>
                <button
                  onClick={() => setActiveTab("vault")}
                  className={`px-3 py-1 rounded-lg transition cursor-pointer flex items-center gap-1.5 ${
                    activeTab === "vault"
                      ? "bg-white dark:bg-zinc-900 text-zinc-900 dark:text-white shadow-xs font-bold"
                      : "text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white"
                  }`}
                >
                  <span>🔐</span>
                  <span>Secret Vault</span>
                </button>
              </div>
            </div>

            {/* Tab Preview Content */}
            <div className="p-6 md:p-8 bg-zinc-50/60 dark:bg-[#0c0c0f] min-h-[340px] flex flex-col justify-center">
              {activeTab === "leads" && (
                <div className="space-y-4">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <div className="flex items-center gap-2">
                        <h4 className="text-sm font-bold text-zinc-900 dark:text-white">Active Pipeline & Spreadsheet Grid</h4>
                        <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/20">
                          Merged Cells Enabled
                        </span>
                      </div>
                      <p className="text-xs text-zinc-500 mt-0.5">Bi-directionally synced with Google Sheet #1BxiMVs0XRA5n...</p>
                    </div>

                    <div className="flex items-center gap-2">
                      <div className="flex items-center gap-1 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-lg p-0.5 text-[11px]">
                        <button
                          onClick={() => setLeadStatusFilter("all")}
                          className={`px-2 py-0.5 rounded ${leadStatusFilter === "all" ? "bg-blue-600 text-white font-semibold" : "text-zinc-500"}`}
                        >
                          All
                        </button>
                        <button
                          onClick={() => setLeadStatusFilter("converted")}
                          className={`px-2 py-0.5 rounded ${leadStatusFilter === "converted" ? "bg-emerald-600 text-white font-semibold" : "text-zinc-500"}`}
                        >
                          Converted
                        </button>
                        <button
                          onClick={() => setLeadStatusFilter("contacted")}
                          className={`px-2 py-0.5 rounded ${leadStatusFilter === "contacted" ? "bg-blue-600 text-white font-semibold" : "text-zinc-500"}`}
                        >
                          Contacted
                        </button>
                      </div>

                      <span className="px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 flex items-center gap-1.5 shrink-0">
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-ping" />
                        Live 2-Way Sync
                      </span>
                    </div>
                  </div>

                  <div className="rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-[#111114] overflow-hidden text-xs shadow-xs">
                    <table className="w-full text-left">
                      <thead className="bg-zinc-50 dark:bg-zinc-900/70 border-b border-zinc-200 dark:border-zinc-800 text-zinc-600 dark:text-zinc-400">
                        <tr>
                          <th className="px-4 py-2.5 font-bold">Client / Company</th>
                          <th className="px-4 py-2.5 font-bold">Category</th>
                          <th className="px-4 py-2.5 font-bold">Deal Status</th>
                          <th className="px-4 py-2.5 font-bold">Phone / Contact</th>
                          <th className="px-4 py-2.5 font-bold">Priority</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800/60">
                        {(leadStatusFilter === "all" || leadStatusFilter === "converted") && (
                          <tr className="hover:bg-slate-50 dark:hover:bg-zinc-900/40 transition">
                            <td className="px-4 py-3 font-semibold text-zinc-900 dark:text-white flex items-center gap-2">
                              <span className="w-6 h-6 rounded-lg bg-blue-500/10 text-blue-600 flex items-center justify-center font-bold text-[10px]">A</span>
                              <span>Apex Digital Labs</span>
                            </td>
                            <td className="px-4 py-3 text-zinc-500">SaaS / Enterprise</td>
                            <td className="px-4 py-3">
                              <span className="px-2.5 py-0.5 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 font-bold text-[11px]">
                                Converted
                              </span>
                            </td>
                            <td className="px-4 py-3 text-zinc-500 font-mono">+1 (555) 392-1829</td>
                            <td className="px-4 py-3 text-amber-500 font-bold">★ High (₹1.2L)</td>
                          </tr>
                        )}
                        {(leadStatusFilter === "all" || leadStatusFilter === "contacted") && (
                          <tr className="hover:bg-slate-50 dark:hover:bg-zinc-900/40 transition">
                            <td className="px-4 py-3 font-semibold text-zinc-900 dark:text-white flex items-center gap-2">
                              <span className="w-6 h-6 rounded-lg bg-purple-500/10 text-purple-600 flex items-center justify-center font-bold text-[10px]">H</span>
                              <span>Horizon Tech Studio</span>
                            </td>
                            <td className="px-4 py-3 text-zinc-500">Design Agency</td>
                            <td className="px-4 py-3">
                              <span className="px-2.5 py-0.5 rounded-full bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/20 font-bold text-[11px]">
                                Contacted
                              </span>
                            </td>
                            <td className="px-4 py-3 text-zinc-500 font-mono">+1 (555) 781-9920</td>
                            <td className="px-4 py-3 text-blue-500 font-bold">★ Medium (₹65k)</td>
                          </tr>
                        )}
                        {leadStatusFilter === "all" && (
                          <tr className="hover:bg-slate-50 dark:hover:bg-zinc-900/40 transition">
                            <td className="px-4 py-3 font-semibold text-zinc-900 dark:text-white flex items-center gap-2">
                              <span className="w-6 h-6 rounded-lg bg-amber-500/10 text-amber-600 flex items-center justify-center font-bold text-[10px]">L</span>
                              <span>Lumina Growth Agency</span>
                            </td>
                            <td className="px-4 py-3 text-zinc-500">Performance Marketing</td>
                            <td className="px-4 py-3">
                              <span className="px-2.5 py-0.5 rounded-full bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20 font-bold text-[11px]">
                                Proposal Sent
                              </span>
                            </td>
                            <td className="px-4 py-3 text-zinc-500 font-mono">+1 (555) 431-0021</td>
                            <td className="px-4 py-3 text-purple-500 font-bold">★ High (₹2.4L)</td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>

                  <div className="flex items-center justify-between text-xs text-zinc-500 pt-1">
                    <span>💡 Tip: Click column headers or range-select cells to merge columns in real-time.</span>
                    <span className="text-zinc-400">Sync delay: &lt; 150ms</span>
                  </div>
                </div>
              )}

              {activeTab === "calendar" && (
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <h4 className="text-sm font-bold text-zinc-900 dark:text-white">Live Calendar & Video Meet Engine</h4>
                      <p className="text-xs text-zinc-500">Pick a slot below to see instant Google Meet link generation</p>
                    </div>
                    <span className="px-2.5 py-1 rounded-full text-xs font-semibold bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/20">
                      Calendly Alternative
                    </span>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <p className="text-xs font-semibold text-zinc-700 dark:text-zinc-300">Available Meeting Slots Today</p>
                      <div className="grid grid-cols-2 gap-2">
                        {[
                          { id: "today-2pm", time: "2:00 PM - 2:30 PM", label: "Strategy Call" },
                          { id: "today-4pm", time: "4:00 PM - 4:45 PM", label: "Product Demo" },
                          { id: "tomorrow-10am", time: "Tomorrow 10:00 AM", label: "Onboarding" },
                          { id: "tomorrow-3pm", time: "Tomorrow 3:00 PM", label: "Discovery" },
                        ].map((slot) => (
                          <button
                            key={slot.id}
                            onClick={() => setSelectedSlot(slot.id)}
                            className={`p-3 rounded-xl text-left transition-all cursor-pointer border ${
                              selectedSlot === slot.id
                                ? "bg-blue-50 dark:bg-blue-950/50 border-blue-500 text-blue-900 dark:text-blue-200 shadow-xs"
                                : "bg-white dark:bg-zinc-900/60 border-zinc-200 dark:border-zinc-800 text-zinc-700 dark:text-zinc-300 hover:border-zinc-300"
                            }`}
                          >
                            <p className="font-bold text-xs">{slot.label}</p>
                            <p className="text-[11px] text-zinc-500 dark:text-zinc-400 mt-0.5">{slot.time}</p>
                          </button>
                        ))}
                      </div>
                    </div>

                    <div className="p-4 rounded-xl bg-white dark:bg-[#111114] border border-zinc-200 dark:border-zinc-800 flex flex-col justify-between">
                      <div>
                        <div className="flex items-center justify-between pb-2 border-b border-zinc-100 dark:border-zinc-800">
                          <span className="font-bold text-xs text-zinc-900 dark:text-white">Active Google Meet Link</span>
                          <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
                            Ready to Join
                          </span>
                        </div>
                        <div className="mt-3 space-y-1.5">
                          <p className="text-xs text-zinc-600 dark:text-zinc-400 font-medium">
                            Room: <span className="font-mono text-zinc-900 dark:text-white font-bold">meet.google.com/xyz-mymanager-live</span>
                          </p>
                          <p className="text-[11px] text-zinc-500">
                            Automatic invitations dispatched to admin & client calendars with 10-minute reminders.
                          </p>
                        </div>
                      </div>

                      <div className="pt-3 border-t border-zinc-100 dark:border-zinc-800 flex items-center justify-between">
                        <span className="text-[11px] text-emerald-600 dark:text-emerald-400 font-semibold flex items-center gap-1">
                          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                          Zero Calendar Collisions
                        </span>
                        <Link
                          href="/book"
                          className="px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs transition active:scale-97"
                        >
                          Book via Meet →
                        </Link>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {activeTab === "drive" && (
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <h4 className="text-sm font-bold text-zinc-900 dark:text-white">BYO-Storage (Google Drive Native)</h4>
                      <p className="text-xs text-zinc-500">Files stream directly into Admin's Google Drive — No third-party AWS S3 charges</p>
                    </div>
                    <span className="px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
                      Zero Storage Markup
                    </span>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <div className="p-4 rounded-xl bg-white dark:bg-[#111114] border border-zinc-200 dark:border-zinc-800 space-y-1.5">
                      <div className="flex items-center justify-between">
                        <span className="font-bold text-xs text-zinc-900 dark:text-white">📁 Finance_Receipts</span>
                        <span className="text-[10px] text-zinc-400">184 Files</span>
                      </div>
                      <p className="text-xs text-zinc-500">Invoices, audit logs, and transaction proofs</p>
                      <div className="pt-2 flex items-center justify-between text-[11px] text-zinc-400">
                        <span>Drive Storage</span>
                        <span className="font-bold text-emerald-600">Free (Included)</span>
                      </div>
                    </div>

                    <div className="p-4 rounded-xl bg-white dark:bg-[#111114] border border-zinc-200 dark:border-zinc-800 space-y-1.5">
                      <div className="flex items-center justify-between">
                        <span className="font-bold text-xs text-zinc-900 dark:text-white">📁 Instagram_Media</span>
                        <span className="text-[10px] text-zinc-400">320 Assets</span>
                      </div>
                      <p className="text-xs text-zinc-500">Carousels, reels, scheduled post media</p>
                      <div className="pt-2 flex items-center justify-between text-[11px] text-zinc-400">
                        <span>Drive Storage</span>
                        <span className="font-bold text-emerald-600">Free (Included)</span>
                      </div>
                    </div>

                    <div className="p-4 rounded-xl bg-white dark:bg-[#111114] border border-zinc-200 dark:border-zinc-800 space-y-1.5">
                      <div className="flex items-center justify-between">
                        <span className="font-bold text-xs text-zinc-900 dark:text-white">📁 Team_Vault_Backups</span>
                        <span className="text-[10px] text-zinc-400">48 Snapshots</span>
                      </div>
                      <p className="text-xs text-zinc-500">Encrypted weekly database backups</p>
                      <div className="pt-2 flex items-center justify-between text-[11px] text-zinc-400">
                        <span>Drive Storage</span>
                        <span className="font-bold text-emerald-600">Free (Included)</span>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {activeTab === "vault" && (
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <h4 className="text-sm font-bold text-zinc-900 dark:text-white">AES-256-GCM Encrypted Credential Vault</h4>
                      <p className="text-xs text-zinc-500">Secure production keys with granular team RBAC & audit logging</p>
                    </div>
                    <span className="px-2.5 py-1 rounded-full text-xs font-semibold bg-purple-500/10 text-purple-600 dark:text-purple-400 border border-purple-500/20">
                      Zero-Knowledge Architecture
                    </span>
                  </div>

                  <div className="p-4 rounded-xl bg-white dark:bg-[#111114] border border-zinc-200 dark:border-zinc-800 space-y-3">
                    <div className="flex items-center justify-between pb-2 border-b border-zinc-100 dark:border-zinc-800">
                      <div className="flex items-center gap-2">
                        <span className="w-7 h-7 rounded-lg bg-amber-500/10 text-amber-500 flex items-center justify-center font-bold text-xs">🔑</span>
                        <div>
                          <p className="font-bold text-xs text-zinc-900 dark:text-white">Stripe Live Production Secret Key</p>
                          <p className="text-[11px] text-zinc-400">Last accessed 2 hours ago by Admin</p>
                        </div>
                      </div>
                      <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
                        AES Encrypted
                      </span>
                    </div>

                    <div className="flex items-center justify-between gap-3 bg-slate-50 dark:bg-zinc-900/60 p-2.5 rounded-xl border border-zinc-200 dark:border-zinc-800 font-mono text-xs">
                      <span className="truncate text-zinc-800 dark:text-zinc-200">
                        {revealedVaultKey ? "sk_live_51Mza89Bv2k0Pq1x93Kl92aPq0981" : "sk_live_••••••••••••••••••••••••••••••••"}
                      </span>
                      <div className="flex items-center gap-2 shrink-0">
                        <button
                          onClick={() => setRevealedVaultKey(!revealedVaultKey)}
                          className="px-2.5 py-1 rounded-lg bg-zinc-200 dark:bg-zinc-800 hover:bg-zinc-300 dark:hover:bg-zinc-700 text-[11px] font-semibold transition cursor-pointer"
                        >
                          {revealedVaultKey ? "Hide" : "Reveal"}
                        </button>
                        <button
                          onClick={handleCopyKey}
                          className="px-2.5 py-1 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-[11px] font-semibold transition cursor-pointer active:scale-95"
                        >
                          {copiedKey ? "Copied! ✓" : "Copy"}
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </section>

      {/* 4. Architecture Explainer: Why the Admin-Centric Model Wins */}
      <section id="architecture" className="py-20 border-t border-zinc-200/80 dark:border-zinc-800/80 bg-white/60 dark:bg-[#0c0c0f]/60 backdrop-blur-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center max-w-3xl mx-auto mb-16">
            <span className="px-3.5 py-1 rounded-full text-xs font-bold tracking-wider uppercase bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/20">
              Core Architectural Advantage
            </span>
            <h2 className="text-3xl sm:text-4xl font-extrabold text-zinc-900 dark:text-white mt-4 tracking-tight">
              Why the "Admin-Centric Workspace Model" Wins
            </h2>
            <p className="text-sm sm:text-base text-zinc-600 dark:text-zinc-400 mt-4 leading-relaxed">
              Traditional SaaS forces every single employee to authorize personal Google accounts, causing token expiries, messy permissions, and files scattered across random drives. My Manager solves this once and for all.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-8 max-w-5xl mx-auto">
            {/* The Old Broken Way */}
            <div className="p-8 rounded-3xl bg-rose-500/5 border border-rose-500/20 space-y-5">
              <div className="flex items-center gap-2.5 text-rose-500 font-bold text-sm">
                <div className="w-8 h-8 rounded-xl bg-rose-500/10 border border-rose-500/20 flex items-center justify-center">
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </div>
                <span>Traditional SaaS (Fragmented & Fragile)</span>
              </div>
              <ul className="text-xs sm:text-sm text-zinc-600 dark:text-zinc-400 space-y-3.5">
                <li className="flex items-start gap-2.5">
                  <span className="text-rose-500 mt-0.5 font-bold shrink-0">✕</span>
                  <span>Every team member must complete cumbersome Google OAuth consent screens.</span>
                </li>
                <li className="flex items-start gap-2.5">
                  <span className="text-rose-500 mt-0.5 font-bold shrink-0">✕</span>
                  <span>Files scatter across separate employee personal drives with no central governance.</span>
                </li>
                <li className="flex items-start gap-2.5">
                  <span className="text-rose-500 mt-0.5 font-bold shrink-0">✕</span>
                  <span>When a team member leaves the company, access to invoices, client leads, and media is lost.</span>
                </li>
                <li className="flex items-start gap-2.5">
                  <span className="text-rose-500 mt-0.5 font-bold shrink-0">✕</span>
                  <span>High monthly storage markup bills charged by third-party cloud hosting providers.</span>
                </li>
              </ul>
            </div>

            {/* The My Manager Way */}
            <div className="p-8 rounded-3xl bg-emerald-500/5 border border-emerald-500/20 space-y-5 shadow-lg relative overflow-hidden">
              <div className="absolute -top-12 -right-12 w-36 h-36 bg-emerald-500/10 rounded-full blur-2xl pointer-events-none" />
              <div className="flex items-center gap-2.5 text-emerald-600 dark:text-emerald-400 font-bold text-sm">
                <div className="w-8 h-8 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center">
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                  </svg>
                </div>
                <span>My Manager Admin-Centric Model</span>
              </div>
              <ul className="text-xs sm:text-sm text-zinc-700 dark:text-zinc-300 space-y-3.5">
                <li className="flex items-start gap-2.5">
                  <span className="text-emerald-500 mt-0.5 font-bold shrink-0">✓</span>
                  <span><strong>Only the Workspace Admin connects Google once</strong> during initial workspace creation.</span>
                </li>
                <li className="flex items-start gap-2.5">
                  <span className="text-emerald-500 mt-0.5 font-bold shrink-0">✓</span>
                  <span>Team members upload proofs, book meetings, and update leads without touching Google credentials.</span>
                </li>
                <li className="flex items-start gap-2.5">
                  <span className="text-emerald-500 mt-0.5 font-bold shrink-0">✓</span>
                  <span>All documents, sheets, and media remain 100% owned inside the Admin's Google Drive.</span>
                </li>
                <li className="flex items-start gap-2.5">
                  <span className="text-emerald-500 mt-0.5 font-bold shrink-0">✓</span>
                  <span>Zero storage markup fees: leverage your existing Google One / Workspace storage for free.</span>
                </li>
              </ul>
            </div>
          </div>
        </div>
      </section>

      {/* 5. Core Feature Bento Grid */}
      <section id="features" className="py-24">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center max-w-3xl mx-auto mb-16">
            <span className="px-3.5 py-1 rounded-full text-xs font-bold tracking-wider uppercase bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/20">
              Powerful Modules
            </span>
            <h2 className="text-3xl sm:text-4xl font-extrabold text-zinc-900 dark:text-white mt-4 tracking-tight">
              Everything Your Agency Needs In One Place
            </h2>
            <p className="text-sm sm:text-base text-zinc-600 dark:text-zinc-400 mt-3">
              Tailor-built for performance, speed, and real-time collaboration.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {/* Feature 1 */}
            <div className="p-7 rounded-3xl bg-white dark:bg-[#111114] border border-zinc-200/80 dark:border-zinc-800 shadow-sm hover:shadow-md transition-all space-y-3.5 group">
              <div className="w-12 h-12 rounded-2xl bg-blue-500/10 border border-blue-500/20 text-blue-600 dark:text-blue-400 flex items-center justify-center font-bold text-lg group-hover:scale-110 transition-transform">
                📊
              </div>
              <h3 className="text-base font-bold text-zinc-900 dark:text-white">2-Way Google Sheets CRM & Merge Cells</h3>
              <p className="text-xs sm:text-sm text-zinc-500 dark:text-zinc-400 leading-relaxed">
                Connect your external Google Sheets. Real-time bi-directional row synchronization, spreadsheet styling, and horizontal cell merging right from your dashboard.
              </p>
            </div>

            {/* Feature 2 */}
            <div className="p-7 rounded-3xl bg-white dark:bg-[#111114] border border-zinc-200/80 dark:border-zinc-800 shadow-sm hover:shadow-md transition-all space-y-3.5 group">
              <div className="w-12 h-12 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-600 dark:text-emerald-400 flex items-center justify-center font-bold text-lg group-hover:scale-110 transition-transform">
                ☁️
              </div>
              <h3 className="text-base font-bold text-zinc-900 dark:text-white">Zero-Markup Google Drive Storage</h3>
              <p className="text-xs sm:text-sm text-zinc-500 dark:text-zinc-400 leading-relaxed">
                Say goodbye to AWS S3 storage bills. Your team's receipts, media assets, and backups stream directly into the Admin's Google Drive.
              </p>
            </div>

            {/* Feature 3 */}
            <div className="p-7 rounded-3xl bg-white dark:bg-[#111114] border border-zinc-200/80 dark:border-zinc-800 shadow-sm hover:shadow-md transition-all space-y-3.5 group">
              <div className="w-12 h-12 rounded-2xl bg-indigo-500/10 border border-indigo-500/20 text-indigo-600 dark:text-indigo-400 flex items-center justify-center font-bold text-lg group-hover:scale-110 transition-transform">
                📅
              </div>
              <h3 className="text-base font-bold text-zinc-900 dark:text-white">Google Calendar & Meet Video Engine</h3>
              <p className="text-xs sm:text-sm text-zinc-500 dark:text-zinc-400 leading-relaxed">
                A Calendly alternative built into your workspace. Inspect live free/busy slots, publish client booking portals, and generate Google Meet rooms on the fly.
              </p>
            </div>

            {/* Feature 4 */}
            <div className="p-7 rounded-3xl bg-white dark:bg-[#111114] border border-zinc-200/80 dark:border-zinc-800 shadow-sm hover:shadow-md transition-all space-y-3.5 group">
              <div className="w-12 h-12 rounded-2xl bg-amber-500/10 border border-amber-500/20 text-amber-600 dark:text-amber-400 flex items-center justify-center font-bold text-lg group-hover:scale-110 transition-transform">
                🔐
              </div>
              <h3 className="text-base font-bold text-zinc-900 dark:text-white">AES-256-GCM Credential Vault</h3>
              <p className="text-xs sm:text-sm text-zinc-500 dark:text-zinc-400 leading-relaxed">
                Store production database passwords, API credentials, and server keys with military-grade encryption, role restrictions, and audit trails.
              </p>
            </div>

            {/* Feature 5 */}
            <div className="p-7 rounded-3xl bg-white dark:bg-[#111114] border border-zinc-200/80 dark:border-zinc-800 shadow-sm hover:shadow-md transition-all space-y-3.5 group">
              <div className="w-12 h-12 rounded-2xl bg-rose-500/10 border border-rose-500/20 text-rose-600 dark:text-rose-400 flex items-center justify-center font-bold text-lg group-hover:scale-110 transition-transform">
                📸
              </div>
              <h3 className="text-base font-bold text-zinc-900 dark:text-white">Instagram Automation & Analytics</h3>
              <p className="text-xs sm:text-sm text-zinc-500 dark:text-zinc-400 leading-relaxed">
                Connect Instagram Business accounts, schedule carousel and video posts, track customer comments, and monitor live engagement metrics.
              </p>
            </div>

            {/* Feature 6 */}
            <div className="p-7 rounded-3xl bg-white dark:bg-[#111114] border border-zinc-200/80 dark:border-zinc-800 shadow-sm hover:shadow-md transition-all space-y-3.5 group">
              <div className="w-12 h-12 rounded-2xl bg-purple-500/10 border border-purple-500/20 text-purple-600 dark:text-purple-400 flex items-center justify-center font-bold text-lg group-hover:scale-110 transition-transform">
                👥
              </div>
              <h3 className="text-base font-bold text-zinc-900 dark:text-white">Granular Team RBAC & Audit Trails</h3>
              <p className="text-xs sm:text-sm text-zinc-500 dark:text-zinc-400 leading-relaxed">
                Assign customized permissions across finance, leads, vault, and calendar. Every action is automatically logged in real-time activity feeds.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* 6. Pricing Tiers */}
      <section id="pricing" className="py-24 border-t border-zinc-200/80 dark:border-zinc-800/80 bg-white/50 dark:bg-[#0c0c0f]/50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center max-w-3xl mx-auto mb-12">
            <span className="px-3.5 py-1 rounded-full text-xs font-bold tracking-wider uppercase bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/20">
              Simple & Transparent
            </span>
            <h2 className="text-3xl sm:text-4xl font-extrabold text-zinc-900 dark:text-white mt-4 tracking-tight">
              Start Free, Scale as Your Team Grows
            </h2>
            <p className="text-sm text-zinc-500 mt-2">Bring your own Google Drive & save hundreds monthly.</p>

            {/* Billing period switcher */}
            <div className="mt-8 inline-flex items-center gap-2 p-1 rounded-full bg-zinc-200/60 dark:bg-zinc-800/70 border border-zinc-200 dark:border-zinc-700/60 text-xs font-semibold">
              <button
                onClick={() => setBillingPeriod("monthly")}
                className={`px-4 py-1.5 rounded-full transition cursor-pointer ${
                  billingPeriod === "monthly"
                    ? "bg-white dark:bg-zinc-900 text-zinc-900 dark:text-white shadow-xs font-bold"
                    : "text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white"
                }`}
              >
                Monthly Billing
              </button>
              <button
                onClick={() => setBillingPeriod("yearly")}
                className={`px-4 py-1.5 rounded-full transition cursor-pointer flex items-center gap-1.5 ${
                  billingPeriod === "yearly"
                    ? "bg-white dark:bg-zinc-900 text-zinc-900 dark:text-white shadow-xs font-bold"
                    : "text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white"
                }`}
              >
                <span>Annual Billing</span>
                <span className="px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 text-[10px] font-bold">
                  Save 20%
                </span>
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 max-w-6xl mx-auto">
            {/* Free Starter */}
            <div className="p-8 rounded-3xl bg-white dark:bg-[#111114] border border-zinc-200/80 dark:border-zinc-800 flex flex-col justify-between space-y-6 shadow-xs hover:border-zinc-300 dark:hover:border-zinc-700 transition">
              <div className="space-y-4">
                <h3 className="text-lg font-bold text-zinc-900 dark:text-white">Starter</h3>
                <div className="text-3xl sm:text-4xl font-extrabold text-zinc-900 dark:text-white">
                  $0 <span className="text-xs text-zinc-500 font-normal">/ month</span>
                </div>
                <p className="text-xs text-zinc-500">Perfect for solo founders, freelancers, and small side projects.</p>
                <ul className="text-xs sm:text-sm text-zinc-600 dark:text-zinc-400 space-y-3 pt-2">
                  <li className="flex items-center gap-2">✓ 1 Workspace Admin</li>
                  <li className="flex items-center gap-2">✓ Google Drive BYO Storage</li>
                  <li className="flex items-center gap-2">✓ Up to 1,000 Leads & Contacts</li>
                  <li className="flex items-center gap-2">✓ Google Calendar Scheduling</li>
                  <li className="flex items-center gap-2 text-zinc-400">✗ Instagram Automation</li>
                </ul>
              </div>
              <Link
                href="/signup"
                className="w-full py-2.5 rounded-xl text-xs font-bold text-center bg-zinc-100 hover:bg-zinc-200 dark:bg-zinc-800 dark:hover:bg-zinc-700 text-zinc-900 dark:text-white transition cursor-pointer"
              >
                Get Started Free
              </Link>
            </div>

            {/* Pro Workspace */}
            <div className="p-8 rounded-3xl bg-white dark:bg-[#131317] border-2 border-blue-600 flex flex-col justify-between space-y-6 shadow-xl relative scale-100 md:scale-105 z-10">
              <div className="absolute -top-3.5 left-1/2 -translate-x-1/2 px-3.5 py-1 rounded-full bg-blue-600 text-white text-[10px] font-bold tracking-wider uppercase shadow-md flex items-center gap-1">
                <span>★</span>
                <span>Most Popular</span>
              </div>
              <div className="space-y-4">
                <h3 className="text-lg font-bold text-zinc-900 dark:text-white">Pro Workspace</h3>
                <div className="text-3xl sm:text-4xl font-extrabold text-zinc-900 dark:text-white">
                  {billingPeriod === "yearly" ? "$24" : "$29"}{" "}
                  <span className="text-xs text-zinc-500 font-normal">/ month</span>
                </div>
                <p className="text-xs text-zinc-500">For fast-growing teams, boutique agencies, and consultancies.</p>
                <ul className="text-xs sm:text-sm text-zinc-700 dark:text-zinc-300 space-y-3 pt-2">
                  <li className="flex items-center gap-2">✓ <strong>Unlimited</strong> Team Members</li>
                  <li className="flex items-center gap-2">✓ Admin-Centric Google Drive & Calendar</li>
                  <li className="flex items-center gap-2">✓ Live 2-Way Google Sheets Sync + Merge</li>
                  <li className="flex items-center gap-2">✓ Automatic Google Meet Rooms</li>
                  <li className="flex items-center gap-2">✓ Instagram Post Scheduling & Feed</li>
                  <li className="flex items-center gap-2">✓ Encrypted Credential Vault</li>
                </ul>
              </div>
              <Link
                href="/signup"
                className="btn-primary w-full py-3.5 rounded-xl text-xs font-bold text-center shadow-md cursor-pointer"
              >
                Start 14-Day Free Pro Trial
              </Link>
            </div>

            {/* Enterprise */}
            <div className="p-8 rounded-3xl bg-white dark:bg-[#111114] border border-zinc-200/80 dark:border-zinc-800 flex flex-col justify-between space-y-6 shadow-xs hover:border-zinc-300 dark:hover:border-zinc-700 transition">
              <div className="space-y-4">
                <h3 className="text-lg font-bold text-zinc-900 dark:text-white">Enterprise</h3>
                <div className="text-3xl sm:text-4xl font-extrabold text-zinc-900 dark:text-white">
                  {billingPeriod === "yearly" ? "$79" : "$99"}{" "}
                  <span className="text-xs text-zinc-500 font-normal">/ month</span>
                </div>
                <p className="text-xs text-zinc-500">For large digital agencies requiring dedicated SLA & onboarding.</p>
                <ul className="text-xs sm:text-sm text-zinc-600 dark:text-zinc-400 space-y-3 pt-2">
                  <li className="flex items-center gap-2">✓ Everything in Pro Workspace</li>
                  <li className="flex items-center gap-2">✓ Custom Domain Booking Portal</li>
                  <li className="flex items-center gap-2">✓ Complete Audit Trail & Activity Logs</li>
                  <li className="flex items-center gap-2">✓ 24/7 Dedicated Support & VIP SLA</li>
                  <li className="flex items-center gap-2">✓ Custom Google Sheets Schema Mapping</li>
                </ul>
              </div>
              <Link
                href="/book"
                className="w-full py-2.5 rounded-xl text-xs font-bold text-center bg-zinc-100 hover:bg-zinc-200 dark:bg-zinc-800 dark:hover:bg-zinc-700 text-zinc-900 dark:text-white transition cursor-pointer"
              >
                Talk to Sales
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* 7. Bottom High-Converting CTA */}
      <section className="py-24 text-center relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-b from-transparent via-blue-600/5 to-transparent pointer-events-none -z-10" />
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10 space-y-6">
          <div className="inline-flex items-center gap-2 px-3.5 py-1 rounded-full bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/20 text-xs font-bold">
            <span>⚡ Ready in under 60 seconds</span>
          </div>
          <h2 className="text-3xl sm:text-5xl font-extrabold tracking-tight text-zinc-900 dark:text-white">
            Ready to upgrade your workspace?
          </h2>
          <p className="text-sm sm:text-base text-zinc-600 dark:text-zinc-400 max-w-xl mx-auto leading-relaxed">
            Connect your Google account in one click and empower your entire team with zero SaaS overhead.
          </p>
          <div className="pt-4 flex flex-col sm:flex-row items-center justify-center gap-4">
            <Link
              href="/signup"
              className="btn-primary px-8 py-3.5 rounded-2xl text-sm font-bold shadow-xl active:scale-97 cursor-pointer w-full sm:w-auto"
            >
              Get Started with Google →
            </Link>
            <Link
              href="/book"
              className="px-6 py-3.5 rounded-2xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 hover:bg-zinc-100 dark:hover:bg-zinc-800 text-zinc-900 dark:text-zinc-100 font-semibold text-sm transition active:scale-97 cursor-pointer w-full sm:w-auto"
            >
              Schedule Live Tour
            </Link>
          </div>
        </div>
      </section>

      {/* 8. Footer */}
      <footer className="border-t border-zinc-200/80 dark:border-zinc-800/80 py-12 bg-white dark:bg-[#070709] text-xs text-zinc-500">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col sm:flex-row items-center justify-between gap-6">
          <div className="flex items-center gap-3">
            <img src="/myicon.png" alt="Logo" className="w-6 h-6 rounded-lg object-contain shadow-xs" />
            <span className="font-bold text-zinc-900 dark:text-white text-sm">My Manager</span>
            <span className="text-zinc-400">• The Unified Digital Business Workspace</span>
          </div>

          <div className="flex items-center gap-6 font-medium">
            <a href="#features" className="hover:text-zinc-900 dark:hover:text-white transition">Features</a>
            <a href="#architecture" className="hover:text-zinc-900 dark:hover:text-white transition">Architecture</a>
            <a href="#pricing" className="hover:text-zinc-900 dark:hover:text-white transition">Pricing</a>
            <Link href="/book" className="hover:text-zinc-900 dark:hover:text-white transition">Book Meeting</Link>
            <Link href="/login" className="hover:text-zinc-900 dark:hover:text-white transition">Sign In</Link>
          </div>

          <div className="flex items-center gap-3 text-zinc-400">
            <span className="inline-flex items-center gap-1 text-[11px] text-emerald-600 dark:text-emerald-400 font-semibold">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
              All Systems Operational
            </span>
            <span>•</span>
            <span>© {new Date().getFullYear()} My Manager SaaS.</span>
          </div>
        </div>
      </footer>
    </div>
  );
}
