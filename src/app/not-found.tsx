import Link from "next/link";

export default function NotFound() {
  return (
    <div className="min-h-screen bg-slate-50 dark:bg-[#070709] flex items-center justify-center px-4">
      <div className="text-center max-w-md space-y-6">
        <div className="text-8xl font-extrabold text-zinc-200 dark:text-zinc-800">404</div>
        <h1 className="text-2xl font-bold text-zinc-900 dark:text-white">Page Not Found</h1>
        <p className="text-sm text-zinc-500 dark:text-zinc-400">
          The page you&apos;re looking for doesn&apos;t exist or has been moved. Let&apos;s get you back on track.
        </p>
        <div className="flex flex-col sm:flex-row items-center justify-center gap-3 pt-2">
          <Link
            href="/"
            className="btn-primary px-6 py-3 rounded-xl text-sm font-bold shadow-md active:scale-97"
          >
            Go to Homepage
          </Link>
          <Link
            href="/contact"
            className="px-6 py-3 rounded-xl bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 dark:hover:bg-zinc-700 text-zinc-900 dark:text-white text-sm font-semibold transition active:scale-97"
          >
            Contact Support
          </Link>
        </div>
      </div>
    </div>
  );
}
