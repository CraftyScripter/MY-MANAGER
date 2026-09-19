import type { Metadata } from "next";
import Link from "next/link";
import Footer from "@/components/Footer";

export const metadata: Metadata = {
  title: "Privacy Policy",
  description:
    "Privacy Policy for My Manager — learn how we collect, use, and protect your data. We respect your privacy and follow Google OAuth compliance standards.",
  openGraph: {
    title: "Privacy Policy — My Manager",
    description:
      "Read the Privacy Policy for My Manager. Learn about data collection, Google OAuth usage, and your rights.",
    type: "website",
  },
};

export default function PrivacyPolicyPage() {
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
            Privacy Policy
          </h1>
          <p className="mt-4 text-sm text-zinc-500">
            Last updated: {lastUpdated}
          </p>
        </div>

        <div className="prose prose-zinc dark:prose-invert max-w-none space-y-10 text-sm leading-relaxed">
          <section>
            <h2 className="text-xl font-bold text-zinc-900 dark:text-white mb-4">1. Introduction</h2>
            <p className="text-zinc-600 dark:text-zinc-400">
              Welcome to My Manager (&quot;we,&quot; &quot;our,&quot; or &quot;us&quot;). We operate the My Manager workspace platform
              accessible at our website. This Privacy Policy explains how we collect, use, disclose, and safeguard your
              information when you use our service. By accessing or using My Manager, you agree to the collection and use
              of information in accordance with this policy.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-bold text-zinc-900 dark:text-white mb-4">2. Information We Collect</h2>
            <div className="space-y-3 text-zinc-600 dark:text-zinc-400">
              <p><strong className="text-zinc-900 dark:text-white">Account Information:</strong> When you sign up via Google OAuth, we receive your Google account email address, display name, and profile photo. We do not collect or store your Google password.</p>
              <p><strong className="text-zinc-900 dark:text-white">Workspace Data:</strong> Files you upload are stored in your own Google Drive under the &quot;MyManager_AppData&quot; folder. We do not store your files on our servers.</p>
              <p><strong className="text-zinc-900 dark:text-white">CRM &amp; Lead Data:</strong> Lead information, deal values, notes, and pipeline data you enter in the CRM are stored in your connected Google Sheets and our encrypted database.</p>
              <p><strong className="text-zinc-900 dark:text-white">Calendar Data:</strong> Meeting bookings and scheduling data sync with your Google Calendar. We access calendar availability to show open slots.</p>
              <p><strong className="text-zinc-900 dark:text-white">Credentials Vault:</strong> API keys and secrets stored in the encrypted vault are encrypted with AES-256-GCM before storage. We cannot read your encrypted vault data.</p>
              <p><strong className="text-zinc-900 dark:text-white">Usage Analytics:</strong> We collect anonymized usage data (page views, feature usage) to improve our service. This data cannot be used to identify you personally.</p>
            </div>
          </section>

          <section>
            <h2 className="text-xl font-bold text-zinc-900 dark:text-white mb-4">3. How We Use Your Information</h2>
            <ul className="list-disc pl-6 space-y-2 text-zinc-600 dark:text-zinc-400">
              <li>To provide, maintain, and improve the My Manager platform</li>
              <li>To sync your CRM data with Google Sheets in real-time</li>
              <li>To manage calendar bookings and generate Google Meet links</li>
              <li>To authenticate your identity via Google OAuth</li>
              <li>To send transactional emails (booking confirmations, team invitations)</li>
              <li>To detect and prevent fraud, abuse, and security incidents</li>
              <li>To comply with legal obligations</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-bold text-zinc-900 dark:text-white mb-4">4. Google OAuth &amp; Google API Services</h2>
            <p className="text-zinc-600 dark:text-zinc-400 mb-3">
              My Manager uses Google OAuth 2.0 for authentication and the Google API for accessing Drive, Sheets, and Calendar data. Our use of Google user data complies with the{" "}
              <a href="https://developers.google.com/terms/api-services-user-data-policy" target="_blank" rel="noopener noreferrer" className="text-blue-500 hover:underline">
                Google API Services User Data Policy
              </a>
              , including the Limited Use requirements.
            </p>
            <ul className="list-disc pl-6 space-y-2 text-zinc-600 dark:text-zinc-400">
              <li>We only access Google data necessary to provide the My Manager service</li>
              <li>We do not sell Google user data to third parties</li>
              <li>We do not use Google data for advertising or marketing purposes</li>
              <li>We do not transfer Google data to other applications unless required for service functionality</li>
              <li>Admin can revoke Google access at any time from the Settings panel</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-bold text-zinc-900 dark:text-white mb-4">5. Data Storage &amp; Security</h2>
            <div className="space-y-3 text-zinc-600 dark:text-zinc-400">
              <p><strong className="text-zinc-900 dark:text-white">Encryption:</strong> All sensitive data (credentials, vault secrets) is encrypted at rest using AES-256-GCM authenticated encryption with unique initialization vectors. Data in transit is encrypted using TLS 1.3.</p>
              <p><strong className="text-zinc-900 dark:text-white">Infrastructure:</strong> My Manager is hosted on Vercel with enterprise-grade infrastructure. Database operations use encrypted connections.</p>
              <p><strong className="text-zinc-900 dark:text-white">Your Data, Your Drive:</strong> Files you upload go directly to your Google Drive. We never store your files on third-party servers like AWS S3.</p>
              <p><strong className="text-zinc-900 dark:text-white">Data Retention:</strong> We retain your data for as long as your account is active. Upon account deletion, all associated data is permanently removed within 30 days.</p>
            </div>
          </section>

          <section>
            <h2 className="text-xl font-bold text-zinc-900 dark:text-white mb-4">6. Data Sharing</h2>
            <p className="text-zinc-600 dark:text-zinc-400">
              We do not sell, trade, or rent your personal information to third parties. We may share data only in the following circumstances:
            </p>
            <ul className="list-disc pl-6 space-y-2 mt-3 text-zinc-600 dark:text-zinc-400">
              <li><strong className="text-zinc-900 dark:text-white">With your consent:</strong> When you explicitly authorize sharing</li>
              <li><strong className="text-zinc-900 dark:text-white">Service providers:</strong> Trusted third-party services that help us operate (e.g., email delivery via Nodemailer) under strict data protection agreements</li>
              <li><strong className="text-zinc-900 dark:text-white">Legal requirements:</strong> When required by law, regulation, or valid legal process</li>
              <li><strong className="text-zinc-900 dark:text-white">Security:</strong> To protect the rights, property, or safety of My Manager, our users, or the public</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-bold text-zinc-900 dark:text-white mb-4">7. Your Rights</h2>
            <ul className="list-disc pl-6 space-y-2 text-zinc-600 dark:text-zinc-400">
              <li><strong className="text-zinc-900 dark:text-white">Access:</strong> You can request a copy of all data we hold about you</li>
              <li><strong className="text-zinc-900 dark:text-white">Correction:</strong> You can update or correct any inaccurate information</li>
              <li><strong className="text-zinc-900 dark:text-white">Deletion:</strong> You can request complete deletion of your account and data</li>
              <li><strong className="text-zinc-900 dark:text-white">Export:</strong> You can export your CRM data, leads, and credentials at any time</li>
              <li><strong className="text-zinc-900 dark:text-white">Revoke Access:</strong> You can disconnect Google integration at any time from Settings</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-bold text-zinc-900 dark:text-white mb-4">8. Cookies</h2>
            <p className="text-zinc-600 dark:text-zinc-400">
              My Manager uses essential session cookies to maintain your login state and preferences. We do not use third-party advertising cookies or tracking pixels. Session cookies are strictly necessary for the service to function and are deleted when you log out.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-bold text-zinc-900 dark:text-white mb-4">9. Children&apos;s Privacy</h2>
            <p className="text-zinc-600 dark:text-zinc-400">
              My Manager is not intended for use by individuals under the age of 18. We do not knowingly collect personal information from children. If we become aware that we have collected data from a child, we will take steps to delete it promptly.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-bold text-zinc-900 dark:text-white mb-4">10. Changes to This Policy</h2>
            <p className="text-zinc-600 dark:text-zinc-400">
              We may update this Privacy Policy from time to time. We will notify you of any material changes by posting the new policy on this page and updating the &quot;Last Updated&quot; date. We encourage you to review this policy periodically.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-bold text-zinc-900 dark:text-white mb-4">11. Contact Us</h2>
            <p className="text-zinc-600 dark:text-zinc-400">
              If you have any questions about this Privacy Policy, please contact us at{" "}
              <a href="mailto:privacy@mymanager.io" className="text-blue-500 hover:underline">
                privacy@mymanager.io
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
