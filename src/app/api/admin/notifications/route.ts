import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser, getEffectiveWorkspaceAdminId } from "@/lib/auth";
import { hasReadPermission } from "@/lib/permissions";

export interface SystemNotification {
  id: string;
  title: string;
  description: string;
  timestamp: string;
  type: "form" | "finance" | "instagram" | "formbridge" | "backup" | "team" | "booking";
  href: string;
}

// Map notification type to required permission
const TYPE_TO_PERMISSION: Record<string, string> = {
  form: "forms",
  formbridge: "forms",
  finance: "finance",
  instagram: "instagram",
  booking: "calendar",
  team: "team",
  backup: "settings",
};

export async function GET() {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const workspaceId = getEffectiveWorkspaceAdminId(user);

  try {
    const now = new Date();
    const last7days = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

    const [
      promiseForms,
      contactForms,
      payments,
      instagramPosts,
      formSubmissions,
      googleAccount,
      appointments,
      workspaceOwner,
      teamMembers,
    ] = await Promise.all([
      // Promise Me enquiries (last 7 days)
      prisma.promiseMeEnquiry.findMany({
        where: { createdAt: { gte: last7days } },
        orderBy: { createdAt: "desc" },
        take: 5,
        select: {
          id: true,
          name: true,
          email: true,
          company: true,
          createdAt: true,
        },
      }).catch(() => []),

      // Contact enquiries (last 7 days)
      prisma.contactEnquiry.findMany({
        where: { createdAt: { gte: last7days } },
        orderBy: { createdAt: "desc" },
        take: 5,
        select: {
          id: true,
          name: true,
          email: true,
          message: true,
          createdAt: true,
        },
      }).catch(() => []),

      // Payments (last 7 days)
      prisma.payment.findMany({
        where: { createdAt: { gte: last7days } },
        orderBy: { createdAt: "desc" },
        take: 5,
        select: {
          id: true,
          transactionId: true,
          amount: true,
          currency: true,
          type: true,
          status: true,
          paidBy: true,
          paidTo: true,
          createdAt: true,
        },
      }).catch(() => []),

      // Instagram posts (last 7 days)
      prisma.instagramPostLog.findMany({
        where: {
          createdAt: { gte: last7days },
          account: { userId: workspaceId },
        },
        orderBy: { createdAt: "desc" },
        take: 5,
        select: {
          id: true,
          caption: true,
          mediaType: true,
          status: true,
          createdAt: true,
        },
      }).catch(() => []),

      // FormBridge submissions (last 7 days)
      prisma.formSubmission.findMany({
        where: { createdAt: { gte: last7days } },
        orderBy: { createdAt: "desc" },
        take: 5,
        select: {
          id: true,
          projectId: true,
          createdAt: true,
        },
      }).catch(() => []),

      // Google Drive backup status
      prisma.googleAccount.findFirst({
        where: { userId: workspaceId },
        select: {
          lastBackupAt: true,
          email: true,
        },
      }).catch(() => null),

      // Appointments (last 7 days)
      prisma.appointment.findMany({
        where: { createdAt: { gte: last7days } },
        orderBy: { createdAt: "desc" },
        take: 5,
        select: {
          id: true,
          title: true,
          clientName: true,
          status: true,
          createdAt: true,
        },
      }).catch(() => []),

      // Workspace owner (first admin) — only they should see team join notifications
      prisma.user.findFirst({
        orderBy: { createdAt: "asc" },
        where: { role: "admin" },
        select: { id: true },
      }).catch(() => null),

      // New team members (last 7 days) — exclude the logged-in user and admins
      prisma.user.findMany({
        where: {
          createdAt: { gte: last7days },
          id: { not: user.id },
          role: { notIn: ["admin", "ADMIN"] },
        },
        orderBy: { createdAt: "desc" },
        take: 5,
        select: {
          id: true,
          name: true,
          email: true,
          role: true,
          createdAt: true,
        },
      }).catch(() => []),
    ]);

    const notifications: SystemNotification[] = [];

    // Form Submissions
    for (const f of promiseForms) {
      notifications.push({
        id: `form-pm-${f.id}`,
        title: "New Enquiry Received",
        description: `${f.name}${f.company ? ` from ${f.company}` : ""} submitted a form`,
        timestamp: f.createdAt.toISOString(),
        type: "form",
        href: "/admin/promise-me",
      });
    }

    for (const c of contactForms) {
      notifications.push({
        id: `form-contact-${c.id}`,
        title: "New Contact Message",
        description: `${c.name}: "${(c.message || "").slice(0, 60)}${(c.message || "").length > 60 ? "..." : ""}"`,
        timestamp: c.createdAt.toISOString(),
        type: "form",
        href: "/admin/promise-me",
      });
    }

    // FormBridge Submissions
    for (const s of formSubmissions) {
      notifications.push({
        id: `fb-${s.id}`,
        title: "FormBridge Submission",
        description: `New form submission received on project`,
        timestamp: s.createdAt.toISOString(),
        type: "formbridge",
        href: `/admin/forms`,
      });
    }

    // Payments
    for (const p of payments) {
      const emoji = p.type === "Income" ? "💰" : p.type === "Expense" ? "💸" : "↩️";
      notifications.push({
        id: `payment-${p.id}`,
        title: `${emoji} Payment ${p.status}`,
        description: `${p.type}: ${p.currency} ${p.amount}${p.paidBy ? ` — ${p.paidBy}` : ""}${p.paidTo ? ` → ${p.paidTo}` : ""}`,
        timestamp: p.createdAt.toISOString(),
        type: "finance",
        href: "/admin/payments",
      });
    }

    // Instagram Activity
    for (const post of instagramPosts) {
      const caption = (post.caption || "Instagram post").slice(0, 60);
      notifications.push({
        id: `ig-${post.id}`,
        title: `Instagram ${post.status}`,
        description: `${caption}${(post.caption || "").length > 60 ? "..." : ""} (${post.mediaType})`,
        timestamp: post.createdAt.toISOString(),
        type: "instagram",
        href: "/admin/instagram",
      });
    }

    // Bookings
    for (const apt of appointments) {
      notifications.push({
        id: `apt-${apt.id}`,
        title: `Meeting ${apt.status}`,
        description: `${apt.title} with ${apt.clientName}`,
        timestamp: apt.createdAt.toISOString(),
        type: "booking",
        href: "/admin/calendar",
      });
    }

    // Team Members — only show to workspace owner
    if (workspaceOwner && user.id === workspaceOwner.id) {
      for (const m of teamMembers) {
        notifications.push({
          id: `team-${m.id}`,
          title: "New Team Member",
          description: `${m.name} (${m.email}) joined as ${m.role}`,
          timestamp: m.createdAt.toISOString(),
          type: "team",
          href: "/admin/team",
        });
      }
    }

    // Backup reminder (if no backup in last 3 days)
    if (googleAccount?.lastBackupAt) {
      const daysSinceBackup = Math.floor(
        (now.getTime() - new Date(googleAccount.lastBackupAt).getTime()) / (1000 * 60 * 60 * 24)
      );
      if (daysSinceBackup >= 3) {
        notifications.push({
          id: "backup-reminder",
          title: "Backup Reminder",
          description: `Last backup was ${daysSinceBackup} days ago. Consider running a backup.`,
          timestamp: googleAccount.lastBackupAt.toISOString(),
          type: "backup",
          href: "/admin/settings",
        });
      }
    } else if (googleAccount) {
      notifications.push({
        id: "backup-none",
        title: "No Backup Found",
        description: "You haven't run a backup yet. Connect Google Drive and create your first backup.",
        timestamp: now.toISOString(),
        type: "backup",
        href: "/admin/settings",
      });
    }

    // Sort descending by timestamp
    notifications.sort(
      (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
    );

    // Filter notifications based on user permissions (team members only see permitted sections)
    const filtered = user.role === "admin"
      ? notifications
      : notifications.filter((n) => {
          const requiredPerm = TYPE_TO_PERMISSION[n.type];
          if (!requiredPerm) return true; // show if no permission mapping
          return hasReadPermission(user.permissions, requiredPerm);
        });

    return NextResponse.json({ notifications: filtered.slice(0, 20) });
  } catch (error) {
    console.error("Notifications error:", error);
    return NextResponse.json({ notifications: [] });
  }
}
