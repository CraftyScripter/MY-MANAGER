import type { Metadata } from "next";
import Link from "next/link";
import Footer from "@/components/Footer";

export const metadata: Metadata = {
  title: "Terms of Service",
  description:
    "Terms of Service for My Manager — review the rules, guidelines, and legal terms that govern your use of our workspace platform.",
  openGraph: {
    title: "Terms of Service — My Manager",
    description:
      "Read the Terms of Service for My Manager SaaS platform. Understand your rights, responsibilities, and our policies.",
    type: "website",
  },
};

export default function TermsPage() {
  const lastUpdated = "September 19, 2026";

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

      {/* Content */}
      <main className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-16 sm:py-24">
        <div className="text-center mb-12">
          <h1 className="text-4xl sm:text-5xl font-extrabold tracking-tight text-zinc-900 dark:text-white">
            Terms of Service
          </h1>
          <p className="mt-4 text-sm text-zinc-500">
            Last updated: {lastUpdated}
          </p>
        </div>

        <div className="prose prose-zinc dark:prose-invert max-w-none space-y-10 text-sm leading-relaxed">
          <section>
            <h2 className="text-xl font-bold text-zinc-900 dark:text-white mb-4">1. Acceptance of Terms</h2>
            <p className="text-zinc-600 dark:text-zinc-400">
              By accessing or using My Manager (&quot;the Service&quot;), you agree to be bound by these Terms of Service. If you do not agree, do not use the Service. These terms apply to all users, including visitors, administrators, team members, and guests.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-bold text-zinc-900 dark:text-white mb-4">2. Description of Service</h2>
            <p className="text-zinc-600 dark:text-zinc-400">
              My Manager is a workspace management platform for digital agencies and teams. It provides CRM, lead management, calendar scheduling, file storage (via Google Drive), credential vaulting, and team collaboration tools. The Service integrates with Google Workspace APIs including Google Drive, Google Sheets, Google Calendar, and Google Meet.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-bold text-zinc-900 dark:text-white mb-4">3. Account Registration</h2>
            <ul className="list-disc pl-6 space-y-2 text-zinc-600 dark:text-zinc-400">
              <li>You must be at least 18 years old to create an account</li>
              <li>You authenticate via Google OAuth — we never store your Google password</li>
              <li>You are responsible for maintaining the security of your account</li>
              <li>You must provide accurate information during registration</li>
              <li>One person or entity may not maintain more than one free account</li>
              <li>You must notify us immediately of any unauthorized access to your account</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-bold text-zinc-900 dark:text-white mb-4">4. Subscription Plans &amp; Payment</h2>
            <div className="space-y-3 text-zinc-600 dark:text-zinc-400">
              <p><strong className="text-zinc-900 dark:text-white">Free Tier:</strong> The Starter plan is free forever with limited features and up to 3 team members.</p>
              <p><strong className="text-zinc-900 dark:text-white">Paid Plans:</strong> Agency Pro and Enterprise plans are billed monthly or annually. Prices are listed on our Pricing page and may be updated with 30 days&apos; notice.</p>
              <p><strong className="text-zinc-900 dark:text-white">No Lock-In:</strong> You can cancel, upgrade, or downgrade at any time. Cancellation takes effect at the end of the current billing period.</p>
              <p><strong className="text-zinc-900 dark:text-white">Refunds:</strong> Annual plan refunds are available within 14 days of purchase. Monthly plans are non-refundable.</p>
            </div>
          </section>

          <section>
            <h2 className="text-xl font-bold text-zinc-900 dark:text-white mb-4">5. Your Data &amp; Ownership</h2>
            <div className="space-y-3 text-zinc-600 dark:text-zinc-400">
              <p><strong className="text-zinc-900 dark:text-white">You own your data:</strong> All CRM data, leads, files, credentials, and other content you create or upload remain your property.</p>
              <p><strong className="text-zinc-900 dark:text-white">Google Drive storage:</strong> Files you upload are stored in your own Google Drive. We have no access to read your unencrypted files.</p>
              <p><strong className="text-zinc-900 dark:text-white">Data portability:</strong> You can export your data (leads, CRM, credentials) at any time in standard formats.</p>
              <p><strong className="text-zinc-900 dark:text-white">Data deletion:</strong> Upon account deletion, all your data is permanently removed from our servers within 30 days. Files in your Google Drive remain yours.</p>
            </div>
          </section>

          <section>
            <h2 className="text-xl font-bold text-zinc-900 dark:text-white mb-4">6. Acceptable Use</h2>
            <p className="text-zinc-600 dark:text-zinc-400 mb-3">You agree NOT to:</p>
            <ul className="list-disc pl-6 space-y-2 text-zinc-600 dark:text-zinc-400">
              <li>Use the Service for any unlawful purpose or in violation of any applicable law</li>
              <li>Attempt to gain unauthorized access to other users&apos; accounts or data</li>
              <li>Upload malware, viruses, or harmful code</li>
              <li>Reverse engineer, decompile, or disassemble any part of the Service</li>
              <li>Use the Service to send spam or unsolicited communications</li>
              <li>Resell or redistribute the Service without written authorization</li>
              <li>Abuse the API or automated systems to overload the infrastructure</li>
              <li>Impersonate another person or entity</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-bold text-zinc-900 dark:text-white mb-4">7. Intellectual Property</h2>
            <p className="text-zinc-600 dark:text-zinc-400">
              The Service, including its design, code, features, branding, and documentation, is the intellectual property of My Manager. You are granted a limited, non-exclusive, non-transferable license to use the Service in accordance with these terms. You may not copy, modify, or create derivative works of the Service.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-bold text-zinc-900 dark:text-white mb-4">8. Service Availability &amp; SLA</h2>
            <p className="text-zinc-600 dark:text-zinc-400">
              We strive to maintain 99.9% uptime. Enterprise plan customers receive a formal SLA agreement. We are not liable for downtime caused by third-party services (Google APIs, Vercel infrastructure, DNS providers). Scheduled maintenance windows will be communicated 48 hours in advance.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-bold text-zinc-900 dark:text-white mb-4">9. Limitation of Liability</h2>
            <p className="text-zinc-600 dark:text-zinc-400">
              To the maximum extent permitted by law, My Manager shall not be liable for any indirect, incidental, special, consequential, or punitive damages, including but not limited to loss of profits, data, or business opportunities. Our total liability shall not exceed the amount you paid us in the 12 months preceding the claim.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-bold text-zinc-900 dark:text-white mb-4">10. Termination</h2>
            <p className="text-zinc-600 dark:text-zinc-400">
              We may suspend or terminate your access to the Service at any time if you violate these terms, with or without notice. Upon termination, your right to use the Service ceases immediately. You may terminate your account at any time from the Settings panel. Provisions that by their nature should survive termination will survive, including data ownership, limitation of liability, and dispute resolution.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-bold text-zinc-900 dark:text-white mb-4">11. Dispute Resolution</h2>
            <p className="text-zinc-600 dark:text-zinc-400">
              Any disputes arising from these terms shall first be resolved through good-faith negotiation. If unresolved within 30 days, disputes shall be submitted to binding arbitration. These terms are governed by the laws of India.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-bold text-zinc-900 dark:text-white mb-4">12. Changes to Terms</h2>
            <p className="text-zinc-600 dark:text-zinc-400">
              We reserve the right to modify these terms at any time. Material changes will be notified via email or in-app notification at least 30 days before they take effect. Continued use of the Service after changes constitutes acceptance of the updated terms.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-bold text-zinc-900 dark:text-white mb-4">13. Contact</h2>
            <p className="text-zinc-600 dark:text-zinc-400">
              Questions about these Terms? Contact us at{" "}
              <a href="mailto:legal@mymanager.io" className="text-blue-500 hover:underline">
                legal@mymanager.io
              </a>{" "}
              or visit our{" "}
              <Link href="/contact" className="text-blue-500 hover:underline">
                Contact page
              </Link>
              .
            </p>
          </section>
        </div>
      </main>

      <Footer />
    </div>
  );
}
