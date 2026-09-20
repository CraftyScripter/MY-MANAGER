import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser, checkPermission, getEffectiveWorkspaceAdminId } from "@/lib/auth";

export async function GET() {
  const user = await getCurrentUser();
  if (!user || !checkPermission(user, "dashboard")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const workspaceId = getEffectiveWorkspaceAdminId(user);

  try {
    const [
      contactCount,
      promiseMeCount,
      contactRepliedCount,
      promiseMeRepliedCount,
      formProjects,
      formSubmissions,
      credentialsCount,
      envVarsCount,
      payments,
      teamMembers,
      recentActivities,
      instagramAccounts,
      instagramPublished,
      instagramScheduled,
      recentInstagramPosts,
    ] = await Promise.all([
      prisma.contactEnquiry.count(),
      prisma.promiseMeEnquiry.count(),
      prisma.contactEnquiry.count({ where: { replied: true } }),
      prisma.promiseMeEnquiry.count({ where: { replied: true } }),
      prisma.formProject.findMany({
        select: { id: true, name: true, slug: true, isActive: true, createdAt: true },
        orderBy: { createdAt: "desc" },
      }),
      prisma.formSubmission.count(),
      prisma.credential.count(),
      prisma.environmentVariable.count(),
      prisma.payment.findMany({
        select: { type: true, amount: true, status: true, date: true, createdAt: true },
        orderBy: { date: "asc" },
      }),
      prisma.workspaceMembership.findMany({
        where: { workspaceId: user.id },
        select: {
          id: true,
          role: true,
          isActive: true,
          permissions: true,
          user: {
            select: { id: true, name: true, email: true },
          },
        },
        orderBy: { createdAt: "desc" },
      }),
      prisma.activityLog.findMany({
        take: 5,
        orderBy: { createdAt: "desc" },
      }),
      prisma.instagramAccount.findMany({
        where: { userId: workspaceId },
        select: { id: true, username: true, followersCount: true, followsCount: true, mediaCount: true },
      }),
      prisma.instagramPostLog.count({
        where: {
          status: "published",
          account: { userId: workspaceId },
        },
      }),
      prisma.instagramPostLog.count({
        where: {
          status: "scheduled",
          account: { userId: workspaceId },
        },
      }),
      prisma.instagramPostLog.findMany({
        where: {
          account: { userId: workspaceId },
        },
        take: 5,
        orderBy: { createdAt: "desc" },
        select: { id: true, caption: true, mediaUrl: true, mediaType: true, status: true, createdAt: true },
      }),
    ]);

    // Submissions calculations
    const totalEnquiries = contactCount + promiseMeCount;
    const repliedEnquiries = contactRepliedCount + promiseMeRepliedCount;
    const pendingEnquiries = totalEnquiries - repliedEnquiries;
    const replyRate = totalEnquiries > 0 ? Math.round((repliedEnquiries / totalEnquiries) * 100) : 0;

    // FormBridge stats
    const activeProjects = formProjects.filter((p) => p.isActive).length;
    const totalFormBridgeSubmissions = formSubmissions;

    // Payments calculations
    let totalIncome = 0;
    let totalExpenses = 0;
    let totalRefunds = 0;
    let pendingAmount = 0;

    const monthlyPaymentMap: Record<string, { income: number; expenses: number; month: string }> = {};

    payments.forEach((p: { type: string; amount: string; status: string; date: Date | null; createdAt: Date }) => {
      const amt = parseFloat(p.amount) || 0;
      const d = p.date ? new Date(p.date) : new Date(p.createdAt);
      const monthKey = d.toLocaleString("en-US", { month: "short", year: "2-digit" });

      if (!monthlyPaymentMap[monthKey]) {
        monthlyPaymentMap[monthKey] = { income: 0, expenses: 0, month: monthKey };
      }

      if (p.status === "Pending") {
        pendingAmount += amt;
      } else if (p.status === "Completed") {
        if (p.type === "Income") {
          totalIncome += amt;
          monthlyPaymentMap[monthKey].income += amt;
        } else if (p.type === "Expense") {
          totalExpenses += amt;
          monthlyPaymentMap[monthKey].expenses += amt;
        } else if (p.type === "Refund") {
          totalRefunds += amt;
        }
      }
    });

    const netBalance = totalIncome - totalExpenses - totalRefunds;
    const financialTrends = Object.values(monthlyPaymentMap);

    return NextResponse.json({
      // Legacy form submissions
      total: totalEnquiries,
      replied: repliedEnquiries,
      pending: pendingEnquiries,
      replyRate,
      // FormBridge
      formBridge: {
        totalProjects: formProjects.length,
        activeProjects,
        totalSubmissions: totalFormBridgeSubmissions,
        projects: formProjects,
      },
      // Finance
      paymentSummary: {
        totalIncome: parseFloat(totalIncome.toFixed(2)),
        totalExpenses: parseFloat(totalExpenses.toFixed(2)),
        totalRefunds: parseFloat(totalRefunds.toFixed(2)),
        netBalance: parseFloat(netBalance.toFixed(2)),
        pendingAmount: parseFloat(pendingAmount.toFixed(2)),
        financialTrends,
      },
      // System
      totalCredentials: credentialsCount,
      totalEnvVars: envVarsCount,
      teamSummary: {
        total: teamMembers.length,
        active: teamMembers.filter((m: { isActive: boolean }) => m.isActive).length,
        members: teamMembers.map((m: any) => ({
          id: m.user.id,
          name: m.user.name,
          email: m.user.email,
          role: m.role,
          isActive: m.isActive,
        })),
      },
      instagramSummary: {
        accounts: instagramAccounts.length,
        published: instagramPublished,
        scheduled: instagramScheduled,
        accountsList: instagramAccounts,
        recentPosts: recentInstagramPosts,
      },
      recentActivities,
    });
  } catch (error) {
    console.error("Stats error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
