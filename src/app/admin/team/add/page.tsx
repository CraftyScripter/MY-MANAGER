"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  SECTION_KEYS,
  SectionKey,
  hasReadPermission,
  hasWritePermission,
} from "@/lib/permissions";

const PERMISSION_CONFIG: Record<
  SectionKey,
  { label: string; description: string; icon: React.ReactNode }
> = {
  dashboard: {
    label: "Dashboard",
    description: "Analytics overview, metrics, and inquiry charts",
    icon: (
      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6A2.25 2.25 0 016 3.75h2.25A2.25 2.25 0 0110.5 6v2.25a2.25 2.25 0 01-2.25 2.25H6a2.25 2.25 0 01-2.25-2.25V6zM3.75 15.75A2.25 2.25 0 016 13.5h2.25a2.25 2.25 0 012.25 2.25V18a2.25 2.25 0 01-2.25 2.25H6A2.25 2.25 0 013.75 18v-2.25zM13.5 6a2.25 2.25 0 012.25-2.25H18A2.25 2.25 0 0120.25 6v2.25A2.25 2.25 0 0118 10.5h-2.25a2.25 2.25 0 01-2.25-2.25V6zM13.5 15.75a2.25 2.25 0 012.25-2.25H18a2.25 2.25 0 012.25 2.25V18A2.25 2.25 0 0118 20.25h-2.25A2.25 2.25 0 0113.5 18v-2.25z" />
      </svg>
    ),
  },
  leads: {
    label: "Leads",
    description: "Spreadsheet, custom sheets, folders, and lead records",
    icon: (
      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 6.75h12M8.25 12h12m-12 5.25h12M3.75 6.75h.007v.008H3.75V6.75zm.375 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zM3.75 12h.007v.008H3.75V12zm.375 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zm-.375 5.25h.007v.008H3.75v-.008zm.375 0a.375.375 0 11-.75 0 .375.375 0 01.75 0z" />
      </svg>
    ),
  },
  forms: {
    label: "Forms / Enquiries",
    description: "Website contact forms and builder enquiries",
    icon: (
      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M11.48 3.499a.562.562 0 011.04 0l2.125 5.111a.563.563 0 00.475.345l5.518.442c.499.04.701.663.321.988l-4.204 3.602a.563.563 0 00-.182.557l1.285 5.385a.562.562 0 01-.84.61l-4.725-2.885a.563.563 0 00-.586 0L6.982 20.54a.562.562 0 01-.84-.61l1.285-5.386a.562.562 0 00-.182-.557l-4.204-3.602a.563.563 0 01.321-.988l5.518-.442a.563.563 0 00.475-.345L11.48 3.5z" />
      </svg>
    ),
  },
  credentials: {
    label: "Password Manager",
    description: "Encrypted credentials, logins, and project access keys",
    icon: (
      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 10.5V6.75a4.5 4.5 0 10-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 002.25-2.25v-6.75a2.25 2.25 0 00-2.25-2.25H6.75a2.25 2.25 0 00-2.25 2.25v6.75a2.25 2.25 0 002.25 2.25z" />
      </svg>
    ),
  },
  finance: {
    label: "Finance / Payments",
    description: "Income, expenses, refunds, and financial summaries",
    icon: (
      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v12m-3-2.818l.879.659c1.171.879 3.07.879 4.242 0 1.172-.879 1.172-2.303 0-3.182C13.536 12.219 12.768 12 12 12c-.725 0-1.45-.22-2.003-.659-1.106-.879-1.106-2.303 0-3.182s2.9-.879 4.006 0l.415.33M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
    ),
  },
  calendar: {
    label: "Calendar & Meetings",
    description: "Google Calendar scheduling, free/busy slots, and Google Meet integration",
    icon: (
      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 012.25-2.25h13.5A2.25 2.25 0 0121 7.5v11.25m-18 0A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75m-18 0v-7.5A2.25 2.25 0 015.25 9h13.5A2.25 2.25 0 0121 9v7.5" />
      </svg>
    ),
  },
  env: {

    label: "Environment Variables",
    description: "Manage project environment variables and deployments",
    icon: (
      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M9.594 3.94c.09-.542.56-.94 1.11-.94h2.593c.55 0 1.02.398 1.11.94l.213 1.281c.063.374.313.686.645.87.074.04.147.083.22.127.325.196.72.257 1.075.124l1.217-.456a1.125 1.125 0 011.37.49l1.296 2.247a1.125 1.125 0 01-.26 1.431l-1.003.827c-.293.241-.438.613-.43.992a7.723 7.723 0 010 .255c-.008.378.137.53.43.991l1.004.827c.424.35.534.955.26 1.43l-1.298 2.247a1.125 1.125 0 01-1.369.491l-1.217-.456c-.355-.133-.75-.072-1.076.124a6.47 6.47 0 01-.22.128c-.331.183-.581.495-.644.869l-.213 1.281c-.09.543-.56.94-1.11.94h-2.594c-.55 0-1.019-.398-1.11-.94l-.213-1.281c-.062-.374-.312-.686-.644-.87a6.52 6.52 0 01-.22-.127c-.325-.196-.72-.257-1.076-.124l-1.217.456a1.125 1.125 0 01-1.369-.49l-1.297-2.247a1.125 1.125 0 01.26-1.431l1.004-.827c.292-.24.437-.613.43-.991a6.932 6.932 0 010-.255c.007-.38-.138-.751-.43-.992l-1.004-.827a1.125 1.125 0 01-.26-1.43l1.297-2.247a1.125 1.125 0 011.37-.491l1.216.456c.356.133.751.072 1.076-.124.072-.044.146-.086.22-.128.332-.183.582-.495.644-.869l.214-1.28z" />
        <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
      </svg>
    ),
  },
  team: {
    label: "Team",
    description: "Manage team members, roles, and section access",
    icon: (
      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M15 19.128a9.38 9.38 0 002.625.372 9.337 9.337 0 004.121-.952 4.125 4.125 0 00-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 018.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0111.964-3.07M12 6.375a3.375 3.375 0 11-6.75 0 3.375 3.375 0 016.75 0zm8.25 2.25a2.625 2.625 0 11-5.25 0 2.625 2.625 0 015.25 0z" />
      </svg>
    ),
  },
  activity_log: {
    label: "Activity Log",
    description: "Audit trail of admin and team actions across the system",
    icon: (
      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
    ),
  },
  instagram: {
    label: "Instagram",
    description: "Connect Instagram account, view and publish posts",
    icon: (
      <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5}>
        <rect x="2" y="2" width="20" height="20" rx="5" ry="5" />
        <path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z" />
        <line x1="17.5" y1="6.5" x2="17.51" y2="6.5" strokeWidth={2.5} strokeLinecap="round" />
      </svg>
    ),
  },
  settings: {
    label: "Settings",
    description: "Application configuration and account security",
    icon: (
      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M9.594 3.94c.09-.542.56-.94 1.11-.94h2.593c.55 0 1.02.398 1.11.94l.213 1.281c.063.374.313.686.645.87.074.04.147.083.22.127.325.196.72.257 1.075.124l1.217-.456a1.125 1.125 0 011.37.49l1.296 2.247a1.125 1.125 0 01-.26 1.431l-1.003.827c-.293.241-.438.613-.43.992a7.723 7.723 0 010 .255c-.008.378.137.53.43.991l1.004.827c.424.35.534.955.26 1.43l-1.298 2.247a1.125 1.125 0 01-1.369.491l-1.217-.456c-.355-.133-.75-.072-1.076.124a6.47 6.47 0 01-.22.128c-.331.183-.581.495-.644.869l-.213 1.281c-.09.543-.56.94-1.11.94h-2.594c-.55 0-1.019-.398-1.11-.94l-.213-1.281c-.062-.374-.312-.686-.644-.87a6.52 6.52 0 01-.22-.127c-.325-.196-.72-.257-1.076-.124l-1.217.456a1.125 1.125 0 01-1.369-.49l-1.297-2.247a1.125 1.125 0 01.26-1.431l1.004-.827c.292-.24.437-.613.43-.991a6.932 6.932 0 010-.255c.007-.38-.138-.751-.43-.992l-1.004-.827a1.125 1.125 0 01-.26-1.43l1.297-2.247a1.125 1.125 0 011.37-.491l1.216.456c.356.133.751.072 1.076-.124.072-.044.146-.086.22-.128.332-.183.582-.495.644-.869l.214-1.28z" />
        <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
      </svg>
    ),
  },
};

type PermissionLevel = "none" | "read" | "write";

function getSectionLevel(permissions: string[], section: SectionKey): PermissionLevel {
  if (hasWritePermission(permissions, section)) return "write";
  if (hasReadPermission(permissions, section)) return "read";
  return "none";
}

function setSectionLevel(
  currentPerms: string[],
  section: SectionKey,
  level: PermissionLevel
): string[] {
  const cleaned = currentPerms.filter(
    (p) => p !== section && p !== `${section}:read` && p !== `${section}:write`
  );

  if (level === "read") {
    return [...cleaned, `${section}:read`];
  }
  if (level === "write") {
    return [...cleaned, `${section}:read`, `${section}:write`];
  }
  return cleaned;
}

export default function AddTeamMemberPage() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [permissions, setPermissions] = useState<string[]>([]);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [successData, setSuccessData] = useState<{
    name: string;
    email: string;
    invitationLink: string;
  } | null>(null);
  const [copied, setCopied] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");

    if (!name.trim()) {
      setError("Full name is required");
      return;
    }

    if (!email.trim() || !email.includes("@")) {
      setError("Valid email address is required");
      return;
    }

    setLoading(true);

    try {
      const res = await fetch("/api/admin/team", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          email: email.trim(),
          phone: phone.trim() || undefined,
          permissions,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || "Failed to create team member");
        setLoading(false);
        return;
      }

      const invLink = data.invitationLink || `${window.location.origin}/accept-invitation?token=${data.invitationToken || data.member?.invitationToken}`;
      setSuccessData({
        name: data.member?.name || name,
        email: data.member?.email || email,
        invitationLink: invLink,
      });
      setLoading(false);
    } catch {
      setError("Something went wrong. Please try again.");
      setLoading(false);
    }
  }

  const copyToClipboard = () => {
    if (!successData?.invitationLink) return;
    navigator.clipboard.writeText(successData.invitationLink);
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  };

  return (
    <div className="w-full max-w-5xl mx-auto p-4 sm:p-6 lg:p-8 space-y-6 text-zinc-900 dark:text-zinc-200">
      {/* Success Modal */}
      {successData && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md p-4 animate-in fade-in duration-150">
          <div className="bg-white dark:bg-[#121216] border border-zinc-200 dark:border-zinc-800 rounded-3xl p-6 sm:p-8 max-w-lg w-full shadow-2xl space-y-6 animate-in zoom-in-95 duration-150">
            <div className="flex items-start gap-4">
              <div className="w-12 h-12 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-500 flex items-center justify-center shrink-0">
                <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                </svg>
              </div>
              <div>
                <h3 className="text-lg font-bold text-zinc-900 dark:text-white">Team Member Invited!</h3>
                <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5">
                  An invitation has been dispatched for <span className="font-semibold text-zinc-900 dark:text-white">{successData.name}</span> ({successData.email}).
                </p>
              </div>
            </div>

            {/* Manual Share Option Box */}
            <div className="p-4 rounded-2xl bg-zinc-50 dark:bg-zinc-900/90 border border-zinc-200 dark:border-zinc-800 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-zinc-700 dark:text-zinc-300 flex items-center gap-1.5">
                  <svg className="w-4 h-4 text-blue-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M13.19 8.688a4.5 4.5 0 011.242 7.244l-4.5 4.5a4.5 4.5 0 01-6.364-6.364l1.757-1.757m13.35-.622l1.757-1.757a4.5 4.5 0 00-6.364-6.364l-4.5 4.5a4.5 4.5 0 001.242 7.244" />
                  </svg>
                  Manual Invitation Link
                </span>
                <span className="text-[10px] text-zinc-400">Expires in 48 hours</span>
              </div>
              <p className="text-[11px] text-zinc-500 dark:text-zinc-400 leading-relaxed">
                Copy this link to manually share with your team member via WhatsApp, Slack, or direct message:
              </p>

              <div className="flex items-center gap-2">
                <input
                  type="text"
                  readOnly
                  value={successData.invitationLink}
                  className="flex-1 bg-white dark:bg-zinc-800/80 border border-zinc-200 dark:border-zinc-700 rounded-xl px-3 py-2 text-xs text-zinc-800 dark:text-zinc-200 font-mono select-all focus:outline-none"
                />
                <button
                  type="button"
                  onClick={copyToClipboard}
                  className="px-3.5 py-2 rounded-xl text-xs font-bold bg-blue-600 hover:bg-blue-500 text-white transition flex items-center gap-1.5 shrink-0 shadow-xs cursor-pointer active:scale-97"
                >
                  {copied ? (
                    <>
                      <svg className="w-3.5 h-3.5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                      </svg>
                      <span>Copied!</span>
                    </>
                  ) : (
                    <>
                      <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 17.25v3.375c0 .621-.504 1.125-1.125 1.125h-9.75a1.125 1.125 0 01-1.125-1.125V7.875c0-.621.504-1.125 1.125-1.125H6.75a9.06 9.06 0 011.5.124m7.5 10.376h3.375c.621 0 1.125-.504 1.125-1.125V11.25c0-4.46-3.243-8.161-7.5-8.876a9.06 9.06 0 00-1.5-.124H9.375c-.621 0-1.125.504-1.125 1.125v3.5m7.5 10.375H9.375a1.125 1.125 0 01-1.125-1.125v-9.25m12 6.625v-1.875a3.375 3.375 0 00-3.375-3.375h-1.5a1.125 1.125 0 01-1.125-1.125v-1.5a3.375 3.375 0 00-3.375-3.375H9.75" />
                      </svg>
                      <span>Copy Link</span>
                    </>
                  )}
                </button>
              </div>
            </div>

            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={() => {
                  setSuccessData(null);
                  setName("");
                  setEmail("");
                  setPhone("");
                  setPermissions([]);
                }}
                className="px-4 py-2.5 rounded-xl text-xs font-semibold text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition cursor-pointer"
              >
                Add Another Member
              </button>
              <button
                type="button"
                onClick={() => router.push("/admin/team")}
                className="px-5 py-2.5 rounded-xl text-xs font-bold bg-zinc-900 dark:bg-white text-white dark:text-zinc-900 hover:opacity-90 transition cursor-pointer shadow-xs active:scale-97"
              >
                Go to Team List &rarr;
              </button>
            </div>
          </div>
        </div>
      )}
      {/* Back Link & Header */}
      <div className="mb-6">
        <Link
          href="/admin/team"
          className="text-xs text-zinc-500 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-white transition inline-flex items-center gap-1.5 mb-3 font-medium cursor-pointer"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5L8.25 12l7.5-7.5" />
          </svg>
          Back to Team Members
        </Link>
        <h1 className="text-xl font-bold tracking-tight text-zinc-900 dark:text-white flex items-center gap-2">
          <span>Add Team Member</span>
        </h1>
        <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-1">
          Invite a new member and configure their granular Read / Write permissions per dashboard section.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        {error && (
          <div className="bg-red-50 dark:bg-red-950/60 border border-red-200 dark:border-red-800/80 text-red-600 dark:text-red-300 text-xs px-4 py-3 rounded-xl flex items-center gap-2.5 shadow-xs">
            <svg className="w-4 h-4 text-red-500 dark:text-red-400 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z" />
            </svg>
            <span>{error}</span>
          </div>
        )}

        {/* Member Information Card */}
        <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl p-5 md:p-6 space-y-4 shadow-sm">
          <h2 className="text-xs font-semibold text-zinc-700 dark:text-zinc-300 uppercase tracking-wider">Account Details</h2>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-zinc-700 dark:text-zinc-300 mb-1.5">
                Full Name <span className="text-red-500 dark:text-red-400">*</span>
              </label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
                autoFocus
                className="w-full bg-slate-50 dark:bg-zinc-800/50 border border-zinc-200 dark:border-zinc-700/80 rounded-xl px-3.5 py-2.5 text-xs text-zinc-900 dark:text-white placeholder:text-zinc-400 dark:placeholder:text-zinc-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20 dark:focus:ring-zinc-500 transition"
                placeholder="e.g. Rahul Sharma"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-zinc-700 dark:text-zinc-300 mb-1.5">
                Email Address <span className="text-red-500 dark:text-red-400">*</span>
              </label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                className="w-full bg-slate-50 dark:bg-zinc-800/50 border border-zinc-200 dark:border-zinc-700/80 rounded-xl px-3.5 py-2.5 text-xs text-zinc-900 dark:text-white placeholder:text-zinc-400 dark:placeholder:text-zinc-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20 dark:focus:ring-zinc-500 transition"
                placeholder="e.g. rahul@example.com"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-zinc-700 dark:text-zinc-300 mb-1.5">
              Phone Number <span className="text-zinc-400 dark:text-zinc-500">(optional)</span>
            </label>
            <input
              type="tel"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              className="w-full bg-slate-50 dark:bg-zinc-800/50 border border-zinc-200 dark:border-zinc-700/80 rounded-xl px-3.5 py-2.5 text-xs text-zinc-900 dark:text-white placeholder:text-zinc-400 dark:placeholder:text-zinc-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20 dark:focus:ring-zinc-500 transition"
              placeholder="e.g. +91 98765 43210"
            />
          </div>
        </div>

        {/* Permissions Card */}
        <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl p-5 md:p-6 shadow-sm">
          <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
            <div>
              <h2 className="text-xs font-semibold text-zinc-700 dark:text-zinc-300 uppercase tracking-wider">Granular Section Access</h2>
              <p className="text-[11px] text-zinc-500 dark:text-zinc-400 mt-0.5">
                Assign Read Only (View) or Read & Write (Full Edit) privileges for each section.
              </p>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => {
                  const allWrite: string[] = SECTION_KEYS.flatMap((sec) => [
                    `${sec}:read`,
                    `${sec}:write`,
                  ]);
                  setPermissions(allWrite);
                }}
                className="px-2.5 py-1 text-[11px] font-medium text-emerald-700 dark:text-emerald-300 hover:text-emerald-800 dark:hover:text-white bg-emerald-50 dark:bg-emerald-950/60 hover:bg-emerald-100 dark:hover:bg-emerald-900/60 border border-emerald-200 dark:border-emerald-800/60 rounded-md transition cursor-pointer"
              >
                Grant All (Write)
              </button>
              <button
                type="button"
                onClick={() => {
                  const allRead: string[] = SECTION_KEYS.map((sec) => `${sec}:read`);
                  setPermissions(allRead);
                }}
                className="px-2.5 py-1 text-[11px] font-medium text-blue-700 dark:text-blue-300 hover:text-blue-800 dark:hover:text-white bg-blue-50 dark:bg-blue-950/60 hover:bg-blue-100 dark:hover:bg-blue-900/60 border border-blue-200 dark:border-blue-800/60 rounded-md transition cursor-pointer"
              >
                Grant All (Read)
              </button>
              <button
                type="button"
                onClick={() => setPermissions([])}
                className="px-2.5 py-1 text-[11px] font-medium text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-200 bg-slate-100 dark:bg-zinc-800/60 hover:bg-slate-200 dark:hover:bg-zinc-700 rounded-md transition cursor-pointer"
              >
                Clear All
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
            {SECTION_KEYS.map((sec) => {
              const config = PERMISSION_CONFIG[sec];
              const currentLevel = getSectionLevel(permissions, sec);

              return (
                <div
                  key={sec}
                  className={`flex flex-col sm:flex-row sm:items-center justify-between p-3 rounded-xl border transition gap-2 ${
                    currentLevel === "write"
                      ? "bg-emerald-50/60 dark:bg-emerald-950/20 border-emerald-200 dark:border-emerald-900/60 shadow-xs"
                      : currentLevel === "read"
                      ? "bg-blue-50/60 dark:bg-blue-950/20 border-blue-200 dark:border-blue-900/60 shadow-xs"
                      : "bg-slate-50/50 dark:bg-[#16161a] border-zinc-200 dark:border-zinc-800/80"
                  }`}
                >
                  <div className="flex items-start gap-3 min-w-0 flex-1">
                    <div
                      className={`p-2 rounded-lg shrink-0 mt-0.5 ${
                        currentLevel === "write"
                          ? "bg-emerald-100 dark:bg-emerald-950/80 border border-emerald-200 dark:border-emerald-800/60 text-emerald-700 dark:text-emerald-400"
                          : currentLevel === "read"
                          ? "bg-blue-100 dark:bg-blue-950/80 border border-blue-200 dark:border-blue-800/60 text-blue-700 dark:text-blue-400"
                          : "bg-slate-200/80 dark:bg-zinc-800/80 border border-zinc-200 dark:border-zinc-700/60 text-zinc-500"
                      }`}
                    >
                      {config.icon}
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-semibold text-zinc-900 dark:text-white">
                          {config.label}
                        </span>
                        {currentLevel === "write" && (
                          <span className="px-1.5 py-0.2 rounded text-[9px] font-mono uppercase font-bold bg-emerald-100 dark:bg-emerald-950 text-emerald-800 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800/60">
                            Read & Write
                          </span>
                        )}
                        {currentLevel === "read" && (
                          <span className="px-1.5 py-0.2 rounded text-[9px] font-mono uppercase font-bold bg-blue-100 dark:bg-blue-950 text-blue-800 dark:text-blue-300 border border-blue-200 dark:border-blue-800/60">
                            Read Only
                          </span>
                        )}
                      </div>
                      <p className="text-[11px] text-zinc-500 dark:text-zinc-400 mt-0.5 leading-snug">
                        {config.description}
                      </p>
                    </div>
                  </div>

                  {/* 3-State Segmented Control */}
                  <div className="inline-flex rounded-lg bg-slate-100 dark:bg-[#18181b] border border-zinc-200 dark:border-zinc-800 p-0.5 shrink-0 self-start sm:self-center">
                    <button
                      type="button"
                      onClick={() => setPermissions(setSectionLevel(permissions, sec, "none"))}
                      className={`px-2 py-1 text-[11px] font-medium rounded-md transition cursor-pointer ${
                        currentLevel === "none"
                          ? "bg-white dark:bg-zinc-700 text-zinc-900 dark:text-zinc-200 font-semibold shadow-xs"
                          : "text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300"
                      }`}
                    >
                      None
                    </button>
                    <button
                      type="button"
                      onClick={() => setPermissions(setSectionLevel(permissions, sec, "read"))}
                      className={`px-2 py-1 text-[11px] font-medium rounded-md transition cursor-pointer flex items-center gap-1 ${
                        currentLevel === "read"
                          ? "bg-blue-600 text-white font-semibold shadow-xs"
                          : "text-zinc-500 dark:text-zinc-400 hover:text-blue-600 dark:hover:text-blue-300"
                      }`}
                    >
                      <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M2.036 12.322a1.012 1.012 0 010-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178z" />
                        <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                      </svg>
                      <span>Read (View)</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setPermissions(setSectionLevel(permissions, sec, "write"))}
                      className={`px-2 py-1 text-[11px] font-medium rounded-md transition cursor-pointer flex items-center gap-1 ${
                        currentLevel === "write"
                          ? "bg-emerald-600 text-white font-semibold shadow-xs"
                          : "text-zinc-500 dark:text-zinc-400 hover:text-emerald-600 dark:hover:text-emerald-300"
                      }`}
                    >
                      <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L6.832 19.82a4.5 4.5 0 01-1.897 1.13l-2.685.8.8-2.685a4.5 4.5 0 011.13-1.897L16.863 4.487zm0 0L19.5 7.125" />
                      </svg>
                      <span>Read & Write (Full)</span>
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center justify-end gap-3 pt-2">
          <Link
            href="/admin/team"
            className="px-4 py-2.5 text-xs font-medium text-zinc-700 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white bg-slate-100 dark:bg-zinc-800 hover:bg-slate-200 dark:hover:bg-zinc-700 rounded-xl transition cursor-pointer"
          >
            Cancel
          </Link>
          <button
            type="submit"
            disabled={loading}
            className="flex items-center gap-2 px-5 py-2.5 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-500 disabled:opacity-50 disabled:cursor-not-allowed rounded-xl transition cursor-pointer shadow-sm active:scale-98"
          >
            {loading && <div className="w-3.5 h-3.5 border-2 border-white/40 border-t-white rounded-full animate-spin" />}
            <span>{loading ? "Sending Invitation..." : "Send Invitation"}</span>
          </button>
        </div>
      </form>
    </div>
  );
}
