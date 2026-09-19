import Link from "next/link";

interface BreadcrumbItem {
  label: string;
  href?: string;
}

export default function Breadcrumbs({ items }: { items: BreadcrumbItem[] }) {
  return (
    <nav className="flex items-center gap-1.5 text-sm text-zinc-500 dark:text-zinc-400 mb-4">
      {items.map((item, index) => (
        <span key={index} className="flex items-center gap-1.5">
          {index > 0 && (
            <svg className="w-3.5 h-3.5 text-zinc-400 dark:text-zinc-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
            </svg>
          )}
          {item.href ? (
            <Link href={item.href} className="hover:text-zinc-900 dark:hover:text-zinc-200 transition-colors">
              {item.label}
            </Link>
          ) : (
            <span className="text-zinc-900 dark:text-zinc-100 font-medium">{item.label}</span>
          )}
        </span>
      ))}
    </nav>
  );
}
