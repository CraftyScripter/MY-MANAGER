import Link from "next/link";

export default function Footer() {
  return (
    <footer className="border-t border-zinc-200 dark:border-zinc-800 py-10 bg-white dark:bg-[#070709] text-xs text-zinc-500">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-8 mb-8">
          {/* Brand */}
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <img src="/myicon.png" alt="My Manager" className="w-6 h-6 rounded-lg object-contain" />
              <span className="font-bold text-sm text-zinc-800 dark:text-zinc-200">My Manager</span>
            </div>
            <p className="text-zinc-500 leading-relaxed">
              The unified workspace OS for modern digital agencies. CRM, calendar, drive &amp; security — all in one place.
            </p>
          </div>

          {/* Product */}
          <div className="space-y-3">
            <h4 className="font-bold text-zinc-800 dark:text-zinc-200 uppercase tracking-wider text-[11px]">Product</h4>
            <div className="space-y-2">
              <Link href="/features" className="block hover:text-zinc-900 dark:hover:text-white transition">Features</Link>
              <Link href="/pricing" className="block hover:text-zinc-900 dark:hover:text-white transition">Pricing</Link>
              <Link href="/book" className="block hover:text-zinc-900 dark:hover:text-white transition">Book Demo</Link>
              <Link href="/login" className="block hover:text-zinc-900 dark:hover:text-white transition">Sign In</Link>
            </div>
          </div>

          {/* Company */}
          <div className="space-y-3">
            <h4 className="font-bold text-zinc-800 dark:text-zinc-200 uppercase tracking-wider text-[11px]">Company</h4>
            <div className="space-y-2">
              <Link href="/about" className="block hover:text-zinc-900 dark:hover:text-white transition">About Us</Link>
              <Link href="/contact" className="block hover:text-zinc-900 dark:hover:text-white transition">Contact</Link>
            </div>
          </div>

          {/* Legal */}
          <div className="space-y-3">
            <h4 className="font-bold text-zinc-800 dark:text-zinc-200 uppercase tracking-wider text-[11px]">Legal</h4>
            <div className="space-y-2">
              <Link href="/privacy" className="block hover:text-zinc-900 dark:hover:text-white transition">Privacy Policy</Link>
              <Link href="/terms" className="block hover:text-zinc-900 dark:hover:text-white transition">Terms of Service</Link>
            </div>
          </div>
        </div>

        <div className="pt-6 border-t border-zinc-200 dark:border-zinc-800 flex flex-col sm:flex-row items-center justify-between gap-3">
          <div>&copy; {new Date().getFullYear()} My Manager SaaS. All rights reserved.</div>
          <div className="flex items-center gap-4">
            <Link href="/" className="hover:text-zinc-900 dark:hover:text-white transition">Home</Link>
            <Link href="/privacy" className="hover:text-zinc-900 dark:hover:text-white transition">Privacy</Link>
            <Link href="/terms" className="hover:text-zinc-900 dark:hover:text-white transition">Terms</Link>
            <Link href="/about" className="hover:text-zinc-900 dark:hover:text-white transition">About</Link>
            <Link href="/contact" className="hover:text-zinc-900 dark:hover:text-white transition">Contact</Link>
          </div>
        </div>
      </div>
    </footer>
  );
}
