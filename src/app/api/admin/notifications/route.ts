import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";

export interface SystemNotification {
  id: string;
  title: string;
  description: string;
  timestamp: string;
  type: "form" | "lead" | "finance" | "security";
  href: string;
}

export async function GET() {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const [promiseForms, contactForms, leads, payments, logs] = await Promise.all([
      prisma.promiseMeEnquiry.findMany({
        orderBy: { createdAt: "desc" },
        take: 5,
        select: {
          id: true,
          name: true,
          email: true,
          company: true,
          projectDetailsOrRequirement: true,
          createdAt: true,
        },
      }).catch(() => []),
      prisma.contactEnquiry.findMany({
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
      prisma.lead.findMany({
        orderBy: { createdAt: "desc" },
        take: 5,
        select: {
          id: true,
          businessName: true,
          email: true,
          category: true,
          createdAt: true,
        },
      }).catch(() => []),
      prisma.payment.findMany({
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
      prisma.activityLog.findMany({
        orderBy: { createdAt: "desc" },
        take: 5,
        select: {
          id: true,
          action: true,
          userName: true,
          userEmail: true,
          section: true,
          details: true,
          createdAt: true,
        },
      }).catch(() => []),
    ]);

    const notifications: SystemNotification[] = [];

    // Format Promise Me enquiries
    for (const f of promiseForms) {
      notifications.push({
        id: `form-pm-${f.id}`,
        title: "New Form Submission",
        description: `${f.name}${f.company ? ` (${f.company})` : ""} submitted enquiry on Promise Me`,
        timestamp: f.createdAt.toISOString(),
        type: "form",
        href: "/admin/promise-me",
      });
    }

    // Format General Contact enquiries
    for (const c of contactForms) {
      notifications.push({
        id: `form-contact-${c.id}`,
        title: "New Contact Message",
        description: `${c.name}: ${c.message?.slice(0, 50) || "New enquiry received"}`,
        timestamp: c.createdAt.toISOString(),
        type: "form",
        href: "/admin/promise-me",
      });
    }

    // Format Leads
    for (const l of leads) {
      notifications.push({
        id: `lead-${l.id}`,
        title: "New Lead Added",
        description: `${l.businessName}${l.category ? ` (${l.category})` : ""}`,
        timestamp: l.createdAt.toISOString(),
        type: "lead",
        href: "/admin/leads",
      });
    }

    // Format Payments
    for (const p of payments) {
      notifications.push({
        id: `payment-${p.id}`,
        title: `Payment ${p.status.toUpperCase()}`,
        description: `${p.type.toUpperCase()}: ${p.currency} ${p.amount} ${p.paidBy ? `by ${p.paidBy}` : ""}`,
        timestamp: p.createdAt.toISOString(),
        type: "finance",
        href: "/admin/payments",
      });
    }

    // Format Activity logs
    for (const log of logs) {
      notifications.push({
        id: `log-${log.id}`,
        title: `Activity: ${log.action}`,
        description: `${log.userName || log.userEmail} in ${log.section}${log.details ? ` (${log.details})` : ""}`,
        timestamp: log.createdAt.toISOString(),
        type: "security",
        href: "/admin/activity-log",
      });
    }

    // Sort descending by timestamp
    notifications.sort(
      (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
    );

    return NextResponse.json({ notifications: notifications.slice(0, 15) });
  } catch (error) {
    console.error("Notifications error:", error);
    return NextResponse.json({ notifications: [] });
  }
}
