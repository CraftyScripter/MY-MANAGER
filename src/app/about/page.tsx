import type { Metadata } from "next";
import Link from "next/link";
import Footer from "@/components/Footer";

export const metadata: Metadata = {
  title: "About Us",
  description:
    "Learn about My Manager — the unified workspace OS built for small and mid-size digital agencies. We help teams replace 5+ SaaS tools with one Google-integrated platform.",
  openGraph: {
    title: "About Us — My Manager",
    description:
      "My Manager is a workspace OS for digital agencies. Built to eliminate SaaS sprawl and give teams 100% data ownership via Google Workspace.",
    type: "website",
  },
};

export default function AboutPage() {
  const stats = [
    { value: "5+", label: "SaaS Tools Replaced" },
    { value: "150ms", label: "Sheet Sync Speed" },
    { value: "100%", label: "Data Ownership" },
    { value: "AES-256", label: "Military Encryption" },
  ];

  const values = [
    {
      title: "Admin-Centric by Design",
      description: "Only the workspace admin connects Google. Your team never exposes personal Google credentials — a single connection controls everything.",
      icon: "🛡️",
    },
    {
      title: "Zero SaaS Sprawl",
      description: "Why pay for Calendly, Trello, Google Workspace add-ons, S3 storage, and a CRM separately? My Manager unifies everything into one workspace.",
      icon: "🎯",
    },
    {
      title: "Your Data, Your Drive",
      description: "Files go straight to your Google Drive. No third-party storage, no markup fees, no lock-in. You own everything.",
      icon: "☁️",
    },
    {
      title: "Built for Agencies",
      description: "Designed by people who understand digital agency workflows — lead pipelines, client scheduling, credential management, and team collaboration.",
      icon: "🚀",
    },
  ];

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-[#070709] text-zinc-900 dark:text-zinc-100 transition-colors duration-200">
      {/* Header */}
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
            <Link href="/features" className="px-3.5 py-1.5 rounded-full hover:text-zinc-900 dark:hover:text-white hover:bg-white dark:hover:bg-zinc-800/80 transition-all">
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
              Sign Up
            </Link>
          </div>
        </div>
      </header>

      {/* Hero */}
      <section className="relative pt-16 pb-20 sm:pt-24 sm:pb-28 text-center px-4 max-w-5xl mx-auto">
        <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-blue-500/10 dark:bg-blue-500/15 border border-blue-500/20 text-xs font-medium text-blue-700 dark:text-blue-300 mb-6 shadow-xs">
          <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
          <span>Built for Digital Agencies</span>
        </div>
        <h1 className="text-4xl sm:text-6xl font-extrabold tracking-tight text-zinc-900 dark:text-white leading-tight">
          We&apos;re on a mission to kill SaaS sprawl.
        </h1>
        <p className="mt-6 text-base sm:text-lg text-zinc-600 dark:text-zinc-400 max-w-3xl mx-auto leading-relaxed">
          Small agencies shouldn&apos;t need 5 different subscriptions just to manage leads, schedule meetings,
          store files, and keep credentials safe. My Manager puts everything in one workspace — connected
          directly to your Google ecosystem.
        </p>
      </section>

      {/* Stats */}
      <section className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 pb-20">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
          {stats.map((stat) => (
            <div
              key={stat.label}
              className="text-center p-6 rounded-2xl bg-white dark:bg-[#111114] border border-zinc-200 dark:border-zinc-800 shadow-sm"
            >
              <div className="text-3xl font-extrabold text-zinc-900 dark:text-white">{stat.value}</div>
              <div className="text-xs text-zinc-500 mt-1 font-medium">{stat.label}</div>
            </div>
          ))}
        </div>
      </section>

      {/* Story */}
      <section className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 pb-20">
        <div className="p-8 sm:p-12 rounded-3xl bg-white dark:bg-[#111114] border border-zinc-200 dark:border-zinc-800 shadow-xl space-y-6">
          <h2 className="text-2xl sm:text-3xl font-extrabold text-zinc-900 dark:text-white tracking-tight">Our Story</h2>
          <div className="space-y-4 text-sm text-zinc-600 dark:text-zinc-400 leading-relaxed">
            <p>
              We started My Manager because we were frustrated watching small agencies juggle between 5 to 10
              different SaaS tools every single day — one for CRM, one for scheduling, another for file storage,
              a separate one for secrets management, and yet another for forms. Each tool came with its own
              subscription fee, login, and permission headache.
            </p>
            <p>
              The real problem? Every team member had to connect their personal Google account to each tool,
              creating a security nightmare. And to top it off, agencies were paying huge markups on storage
              that was ultimately going to AWS S3 anyway — when they already had Google Drive.
            </p>
            <p>
              So we built My Manager: a single workspace that connects once through the admin&apos;s Google account,
              syncs leads directly with Google Sheets in under 150ms, schedules meetings with native Google Meet
              links, stores files in your own Google Drive (zero markups), and encrypts your credentials with
              AES-256-GCM military-grade encryption.
            </p>
            <p>
              One tool. One price. One Google connection. That&apos;s the agency workspace, reimagined.
            </p>
          </div>
        </div>
      </section>

      {/* Values */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pb-20">
        <div className="text-center mb-12">
          <h2 className="text-2xl sm:text-3xl font-extrabold text-zinc-900 dark:text-white tracking-tight">
            What We Stand For
          </h2>
          <p className="text-sm text-zinc-500 mt-2">
            The principles that drive every decision we make.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {values.map((value) => (
            <div
              key={value.title}
              className="p-8 rounded-3xl bg-white dark:bg-[#111114] border border-zinc-200 dark:border-zinc-800 shadow-lg hover:shadow-xl transition-all"
            >
              <div className="text-3xl mb-4">{value.icon}</div>
              <h3 className="text-lg font-bold text-zinc-900 dark:text-white mb-2">{value.title}</h3>
              <p className="text-sm text-zinc-600 dark:text-zinc-400 leading-relaxed">{value.description}</p>
            </div>
          ))}
        </div>
      </section>

      {/* CTA */}
      <section className="bg-gradient-to-b from-transparent to-blue-50/50 dark:to-blue-950/20 py-20 border-t border-zinc-200/80 dark:border-zinc-800/80 text-center px-4">
        <div className="max-w-3xl mx-auto space-y-6">
          <h2 className="text-3xl sm:text-4xl font-extrabold text-zinc-900 dark:text-white tracking-tight">
            Ready to simplify your agency?
          </h2>
          <p className="text-sm sm:text-base text-zinc-600 dark:text-zinc-400">
            Join agencies that replaced 5+ SaaS tools with one workspace. Sign up in 30 seconds — no credit card required.
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
              Book Live Strategy Demo &rarr;
            </Link>
          </div>
        </div>
      </section>

      <Footer />
    </div>
  );
}
