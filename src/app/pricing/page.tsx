"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import ThemeToggle from "@/components/ThemeToggle";
import Footer from "@/components/Footer";

export default function PricingPage() {
  const [billingPeriod, setBillingPeriod] = useState<"monthly" | "yearly">("yearly");
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

  const plans = [
    {
      name: "Starter",
      badge: "Free Forever",
      priceMonthly: "₹0",
      priceYearly: "₹0",
      period: "forever",
      description: "Perfect for solo consultants and early-stage freelancers getting started.",
      features: [
        "Up to 3 Team Members",
        "1 Connected Google Sheet (1,000 leads)",
        "Google Calendar booking link",
        "Standard Google Drive folder sync",
        "Community Support",
      ],
      ctaText: "Get Started Free",
      ctaHref: "/signup",
      highlighted: false,
    },
    {
      name: "Agency Pro",
      badge: "Most Popular",
      priceMonthly: "₹2,499",
      priceYearly: "₹1,999",
      period: "per month, billed annually",
      description: "Designed for growing digital agencies and teams scaling their lead pipeline.",
      features: [
        "Unlimited Team Members with RBAC",
        "Unlimited Google Sheets with 2-Way Live Sync",
        "Cell Merging & Formula Preservation",
        "Instant Google Meet Video Links",
        "BYO Google Drive (Zero Extra Storage Bills)",
        "Automated DNS MX Lead Verification",
        "AES-256-GCM Encrypted Secret Vault",
        "Priority 24/7 WhatsApp & Email Support",
      ],
      ctaText: "Start 14-Day Free Trial",
      ctaHref: "/signup",
      highlighted: true,
    },
    {
      name: "Enterprise",
      badge: "Full Customization",
      priceMonthly: "₹7,999",
      priceYearly: "₹6,499",
      period: "per month, billed annually",
      description: "For established marketing firms requiring custom domains, multi-tenancy & SLA.",
      features: [
        "Everything in Agency Pro",
        "Multiple Admin Workspace Accounts",
        "Custom Domain for Booking Pages",
        "Dedicated Account Manager",
        "Custom Google Cloud Service Integrations",
        "99.99% Uptime SLA Agreement",
        "Custom Security Audits & Logs",
      ],
      ctaText: "Contact for Enterprise",
      ctaHref: "/book",
      highlighted: false,
    },
  ];

  const faqs = [
    {
      q: "Why does My Manager use Google Drive instead of AWS S3?",
      a: "Traditional SaaS platforms mark up AWS S3 storage by 300% to 500%. With My Manager, files stream straight into your own Google Drive (`MyManager_AppData`). You pay zero storage fees to us, retain 100% data ownership, and can access your files inside Google Drive at any time.",
    },
    {
      q: "Do all my team members need to link their Google accounts?",
      a: "No! This is the superpower of our Admin-Centric architecture. Only the workspace Admin connects their Google account once. Your team members simply sign in to My Manager and can upload files, view CRM leads, and schedule calls without ever connecting their personal Google accounts.",
    },
    {
      q: "How does the 2-Way Google Sheet Sync work?",
      a: "When you or your team edit any lead status, phone number, category, or deal value inside My Manager, it updates your Google Sheet within 150ms. Edits made directly in Google Sheets are also mirrored in My Manager.",
    },
    {
      q: "Can I cancel or change plans at any time?",
      a: "Yes! There are no lock-in contracts. You can upgrade, downgrade, or cancel your subscription at any time directly from the settings panel.",
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
            <Link href="/features" className="px-3.5 py-1.5 rounded-full hover:text-zinc-900 dark:hover:text-white hover:bg-white dark:hover:bg-zinc-800/80 transition-all">
              Features
            </Link>
            <Link href="/pricing" className="px-3.5 py-1.5 rounded-full bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white shadow-xs font-bold transition-all">
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
      <section className="relative pt-16 pb-12 sm:pt-24 sm:pb-16 text-center px-4 max-w-5xl mx-auto">
        <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-blue-500/10 dark:bg-blue-500/15 border border-blue-500/20 text-xs font-medium text-blue-700 dark:text-blue-300 mb-6 shadow-xs">
          <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
          <span>Simple, Transparent Pricing</span>
        </div>
        <h1 className="text-4xl sm:text-6xl font-extrabold tracking-tight text-zinc-900 dark:text-white leading-tight">
          Invest in your agency's productivity, not SaaS markups.
        </h1>
        <p className="mt-6 text-base sm:text-lg text-zinc-600 dark:text-zinc-400 max-w-3xl mx-auto leading-relaxed">
          Zero per-user gouging. Zero storage markups. Pay one predictable price and connect directly to your Google ecosystem.
        </p>

        {/* Billing toggle */}
        <div className="mt-10 flex items-center justify-center gap-3">
          <span className={`text-xs font-semibold ${billingPeriod === "monthly" ? "text-zinc-900 dark:text-white font-bold" : "text-zinc-500"}`}>
            Monthly Billing
          </span>
          <button
            onClick={() => setBillingPeriod(billingPeriod === "monthly" ? "yearly" : "monthly")}
            className="w-14 h-7 rounded-full bg-zinc-200 dark:bg-zinc-800 p-1 relative transition-colors cursor-pointer"
            aria-label="Toggle billing period"
          >
            <div
              className={`w-5 h-5 rounded-full bg-blue-600 transition-transform ${
                billingPeriod === "yearly" ? "translate-x-7" : "translate-x-0"
              }`}
            />
          </button>
          <div className="flex items-center gap-1.5">
            <span className={`text-xs font-semibold ${billingPeriod === "yearly" ? "text-zinc-900 dark:text-white font-bold" : "text-zinc-500"}`}>
              Yearly Billing
            </span>
            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
              Save 20%
            </span>
          </div>
        </div>
      </section>

      {/* 3. Pricing Cards */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pb-24">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 items-stretch">
          {plans.map((plan) => (
            <div
              key={plan.name}
              className={`rounded-3xl p-8 flex flex-col justify-between transition-all duration-300 relative ${
                plan.highlighted
                  ? "bg-white dark:bg-[#111114] border-2 border-blue-500 shadow-2xl shadow-blue-500/10 scale-105 z-10"
                  : "bg-white dark:bg-[#111114] border border-zinc-200 dark:border-zinc-800 shadow-xl hover:shadow-2xl"
              }`}
            >
              {plan.highlighted && (
                <div className="absolute -top-3.5 left-1/2 -translate-x-1/2 px-4 py-1 rounded-full bg-blue-600 text-white text-[11px] font-bold tracking-wide shadow-md">
                  MOST POPULAR
                </div>
              )}

              <div>
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-xl font-bold text-zinc-900 dark:text-white">{plan.name}</h3>
                  <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400">
                    {plan.badge}
                  </span>
                </div>

                <div className="mb-4">
                  <span className="text-4xl font-extrabold text-zinc-900 dark:text-white">
                    {billingPeriod === "yearly" ? plan.priceYearly : plan.priceMonthly}
                  </span>
                  <span className="text-xs text-zinc-500 ml-1.5">
                    {plan.priceMonthly === "₹0" ? plan.period : billingPeriod === "yearly" ? "/month (billed yearly)" : "/month"}
                  </span>
                </div>

                <p className="text-xs text-zinc-600 dark:text-zinc-400 mb-6 leading-relaxed">
                  {plan.description}
                </p>

                <div className="pt-6 border-t border-zinc-100 dark:border-zinc-800/80 space-y-3 mb-8">
                  {plan.features.map((feat, idx) => (
                    <div key={idx} className="flex items-start gap-2.5 text-xs text-zinc-700 dark:text-zinc-300">
                      <span className="w-4 h-4 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 flex items-center justify-center font-bold text-[10px] shrink-0 mt-0.5">
                        ✓
                      </span>
                      <span>{feat}</span>
                    </div>
                  ))}
                </div>
              </div>

              <Link
                href={plan.ctaHref}
                className={`w-full py-3.5 px-4 rounded-xl text-xs font-bold text-center transition cursor-pointer active:scale-97 block ${
                  plan.highlighted
                    ? "btn-primary shadow-lg shadow-blue-500/25"
                    : "bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 dark:hover:bg-zinc-700 text-zinc-900 dark:text-white"
                }`}
              >
                {plan.ctaText} &rarr;
              </Link>
            </div>
          ))}
        </div>
      </section>

      {/* 4. FAQ Section */}
      <section className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 pb-24">
        <div className="text-center mb-12">
          <h2 className="text-2xl sm:text-3xl font-extrabold text-zinc-900 dark:text-white tracking-tight">
            Frequently Asked Questions
          </h2>
          <p className="text-xs sm:text-sm text-zinc-500 mt-2">
            Everything you need to know about billing, Google data ownership, and permissions.
          </p>
        </div>

        <div className="space-y-4">
          {faqs.map((faq, idx) => (
            <div
              key={idx}
              className="p-6 rounded-2xl bg-white dark:bg-[#111114] border border-zinc-200 dark:border-zinc-800 shadow-xs"
            >
              <h3 className="text-sm font-bold text-zinc-900 dark:text-white mb-2">
                {faq.q}
              </h3>
              <p className="text-xs text-zinc-600 dark:text-zinc-400 leading-relaxed">
                {faq.a}
              </p>
            </div>
          ))}
        </div>
      </section>

      {/* 5. Footer */}
      <Footer />
    </div>
  );
}
