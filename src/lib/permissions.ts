export const SECTIONS = {
  dashboard: { label: "Dashboard", href: "/admin", description: "Analytics overview, metrics, and inquiry charts" },
  leads: { label: "Leads", href: "/admin/leads", description: "Spreadsheet, custom sheets, folders, and lead records" },
  forms: { label: "Forms / Enquiries", href: "/admin/promise-me", description: "Website contact forms and builder enquiries" },
  credentials: { label: "Credentials", href: "/admin/credentials", description: "Encrypted credentials, logins, and project access keys" },
  finance: { label: "Finance / Payments", href: "/admin/payments", description: "Income, expenses, refunds, and financial summaries" },
  calendar: { label: "Calendar & Meetings", href: "/admin/calendar", description: "Google Calendar scheduling, free/busy slots, and Google Meet integration" },
  env: { label: "Environment Variables", href: "/admin/env", description: "Manage project environment variables and deployments" },
  team: { label: "Team", href: "/admin/team", description: "Manage team members, roles, and section access" },
  activity_log: { label: "Activity Log", href: "/admin/activity-log", description: "Audit trail of admin and team actions across the system" },
  instagram: { label: "Instagram", href: "/admin/instagram", description: "Connect Instagram account, view and publish posts" },
  settings: { label: "Settings", href: "/admin/settings", description: "Application configuration and account security" },
} as const;

export type SectionKey = keyof typeof SECTIONS;
export const SECTION_KEYS = Object.keys(SECTIONS) as SectionKey[];

export type PermissionAction = "read" | "write";
export type GranularPermission = `${SectionKey}:${PermissionAction}`;

// Generate all granular permissions: e.g. "leads:read", "leads:write", ...
export const ALL_GRANULAR_PERMISSIONS: GranularPermission[] = SECTION_KEYS.flatMap(
  (sec) => [`${sec}:read` as const, `${sec}:write` as const]
);

// Backward-compatible ALL_PERMISSIONS list (contains both granular and bare keys)
export const ALL_PERMISSIONS: string[] = [
  ...SECTION_KEYS,
  ...ALL_GRANULAR_PERMISSIONS,
];

export const SECTION_PERMISSION_MAP: Record<string, SectionKey> = {
  "/admin": "dashboard",
  "/admin/all": "leads",
  "/admin/leads": "leads",
  "/admin/promise-me": "forms",
  "/admin/credentials": "credentials",
  "/admin/payments": "finance",
  "/admin/calendar": "calendar",
  "/admin/env": "env",
  "/admin/instagram": "instagram",
  "/admin/team": "team",
  "/admin/activity-log": "activity_log",
  "/admin/settings": "settings",
};

export const API_PERMISSION_MAP: Record<string, SectionKey> = {
  "/api/admin/stats": "dashboard",
  "/api/admin/recent": "dashboard",
  "/api/admin/enquiries": "leads",
  "/api/admin/reply": "leads",
  "/api/admin/leads": "leads",
  "/api/admin/promise-me": "forms",
  "/api/admin/credentials": "credentials",
  "/api/admin/payments": "finance",
  "/api/admin/calendar": "calendar",
  "/api/admin/env": "env",
  "/api/admin/instagram": "instagram",
  "/api/admin/team": "team",
  "/api/admin/activity-log": "activity_log",
};


/**
 * Checks if userPermissions has read access to a given section.
 */
export function hasReadPermission(userPermissions: string[], section: string): boolean {
  if (!userPermissions || !Array.isArray(userPermissions)) return false;
  const s = section.toLowerCase();
  return userPermissions.some((p) => {
    if (!p || typeof p !== "string") return false;
    const pl = p.toLowerCase();
    return (
      pl === `${s}:read` ||
      pl === `${s}:write` ||
      pl === s ||
      pl === "all" ||
      pl === "all:read" ||
      pl === "all:write" ||
      pl === "*"
    );
  });
}

/**
 * Checks if userPermissions has write access to a given section.
 */
export function hasWritePermission(userPermissions: string[], section: string): boolean {
  if (!userPermissions || !Array.isArray(userPermissions)) return false;
  const s = section.toLowerCase();
  return userPermissions.some((p) => {
    if (!p || typeof p !== "string") return false;
    const pl = p.toLowerCase();
    return (
      pl === `${s}:write` ||
      pl === s ||
      pl === "all" ||
      pl === "all:write" ||
      pl === "*"
    );
  });
}

/**
 * Universal permission check function supporting action scope.
 */
export function hasPermission(
  userPermissions: string[],
  sectionOrPermission: string,
  action: PermissionAction = "read"
): boolean {
  if (!userPermissions || !Array.isArray(userPermissions)) return false;

  if (sectionOrPermission.includes(":")) {
    const [sec, act] = sectionOrPermission.split(":") as [string, PermissionAction];
    return act === "write"
      ? hasWritePermission(userPermissions, sec)
      : hasReadPermission(userPermissions, sec);
  }

  return action === "write"
    ? hasWritePermission(userPermissions, sectionOrPermission)
    : hasReadPermission(userPermissions, sectionOrPermission);
}

export function hasAnyPermission(
  userPermissions: string[],
  sections: string[],
  action: PermissionAction = "read"
): boolean {
  return sections.some((s) => hasPermission(userPermissions, s, action));
}

export function getPermissionForPath(pathname: string): SectionKey | null {
  if (pathname === "/admin") return "dashboard";
  const sorted = Object.keys(SECTION_PERMISSION_MAP)
    .filter((k) => k !== "/admin")
    .sort((a, b) => b.length - a.length);
  for (const route of sorted) {
    if (pathname === route || pathname.startsWith(route + "/")) {
      return SECTION_PERMISSION_MAP[route];
    }
  }
  return null;
}

export function getPermissionForApi(pathname: string): SectionKey | null {
  const sorted = Object.keys(API_PERMISSION_MAP).sort(
    (a, b) => b.length - a.length
  );
  for (const route of sorted) {
    if (pathname === route || pathname.startsWith(route + "/")) {
      return API_PERMISSION_MAP[route];
    }
  }
  return null;
}

export function notifyAuthPermissionsChanged() {
  if (typeof window === "undefined") return;
  try {
    window.dispatchEvent(new Event("auth-user-updated"));
    const bc = new BroadcastChannel("pm_auth_sync");
    bc.postMessage({ type: "PERMISSIONS_UPDATED", timestamp: Date.now() });
    bc.close();
  } catch {}
  try {
    localStorage.setItem("pm_auth_sync", String(Date.now()));
  } catch {}
}

