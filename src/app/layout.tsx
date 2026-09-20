import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { ThemeProvider } from "@/components/ThemeProvider";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  metadataBase: new URL("https://my-manager-eight.vercel.app"),
  title: {
    default: "My Manager — Unified Workspace OS for Digital Agencies",
    template: "%s | My Manager",
  },
  description:
    "Replace 5+ SaaS tools with one workspace. Manage CRM leads, schedule Google Meet calls, sync Google Sheets, store files in Google Drive, and secure credentials — all from a single admin-centric dashboard.",
  keywords: [
    "workspace OS",
    "digital agency tool",
    "CRM for agencies",
    "Google Sheets sync",
    "Google Meet scheduling",
    "lead management",
    "agency dashboard",
    "SaaS alternative",
    "Google Drive storage",
    "team collaboration",
  ],
  authors: [{ name: "My Manager" }],
  creator: "My Manager",
  publisher: "My Manager",
  openGraph: {
    type: "website",
    locale: "en_US",
    siteName: "My Manager",
    title: "My Manager — Unified Workspace OS for Digital Agencies",
    description:
      "Replace 5+ SaaS tools with one workspace. CRM, calendar, drive, and security — connected to your Google ecosystem.",
    images: [
      {
        url: "/myicon.png",
        width: 512,
        height: 512,
        alt: "My Manager — Workspace OS",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "My Manager — Unified Workspace OS for Digital Agencies",
    description:
      "Replace 5+ SaaS tools with one workspace. CRM, calendar, drive, and security — connected to your Google ecosystem.",
    images: ["/myicon.png"],
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-video-preview": -1,
      "max-image-preview": "large",
      "max-snippet": -1,
    },
  },
  icons: {
    icon: "/myicon.png",
    shortcut: "/myicon.png",
    apple: "/myicon.png",
  },
  alternates: {
    canonical: "https://my-manager-eight.vercel.app",
  },
  verification: {
    google: "h5gLykqBftTwAeAXIS8OzfzpFAZ3aBwkIRXAwRMA2oU",
  },
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
      suppressHydrationWarning
    >
      <body className="min-h-full flex flex-col transition-colors duration-200" suppressHydrationWarning>
        <ThemeProvider>
          {children}
          <div id="portal" />
        </ThemeProvider>
      </body>
    </html>
  );
}
