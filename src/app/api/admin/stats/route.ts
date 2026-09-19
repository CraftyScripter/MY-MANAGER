import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser, checkPermission } from "@/lib/auth";

export async function GET() {
  const user = await getCurrentUser();
  if (!user || !checkPermission(user, "dashboard")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  try {
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const [
      contactCount,
      promiseMeCount,
      contactRepliedCount,
      promiseMeRepliedCount,
      leadsTotal,
      leadsLast30Days,
      leads,
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
      prisma.lead.count(),
      prisma.lead.count({ where: { createdAt: { gte: thirtyDaysAgo } } }),
      prisma.lead.findMany({ select: { category: true, status: true } }),
      prisma.credential.count(),
      prisma.environmentVariable.count(),
      prisma.payment.findMany({
        select: { type: true, amount: true, status: true, date: true, createdAt: true },
        orderBy: { date: "asc" },
      }),
      prisma.user.findMany({
        select: { id: true, name: true, email: true, role: true, isActive: true },
      }),
      prisma.activityLog.findMany({
        take: 5,
        orderBy: { createdAt: "desc" },
      }),
      prisma.instagramAccount.findMany({
        select: { id: true, username: true, followersCount: true, followsCount: true, mediaCount: true },
      }),
      prisma.instagramPostLog.count({ where: { status: "published" } }),
      prisma.instagramPostLog.count({ where: { status: "scheduled" } }),
      prisma.instagramPostLog.findMany({
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

    // Payments calculations
    let totalIncome = 0;
    let totalExpenses = 0;
    let totalRefunds = 0;
    let pendingAmount = 0;

    // Group payments by Month (e.g. Jan, Feb, Mar)
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

    // Lead Category / Source Breakdown
    const categoryCountMap: Record<string, number> = {};
    leads.forEach((l: { category: string | null; status: string }) => {
      const cat = l.category?.trim() || "Uncategorized";
      categoryCountMap[cat] = (categoryCountMap[cat] || 0) + 1;
    });

    const leadSourceBreakdown = Object.entries(categoryCountMap).map(([name, count]) => ({
      name,
      count,
      percentage: leadsTotal > 0 ? parseFloat(((count / leadsTotal) * 100).toFixed(1)) : 0,
    }));

    return NextResponse.json({
      total: totalEnquiries,
      replied: repliedEnquiries,
      pending: pendingEnquiries,
      replyRate,
      leads: {
        total: leadsTotal,
        last30Days: leadsLast30Days,
        sources: leadSourceBreakdown,
      },
      paymentSummary: {
        totalIncome: parseFloat(totalIncome.toFixed(2)),
        totalExpenses: parseFloat(totalExpenses.toFixed(2)),
        totalRefunds: parseFloat(totalRefunds.toFixed(2)),
        netBalance: parseFloat(netBalance.toFixed(2)),
        pendingAmount: parseFloat(pendingAmount.toFixed(2)),
        financialTrends,
      },
      totalCredentials: credentialsCount,
      totalEnvVars: envVarsCount,
      teamSummary: {
        total: teamMembers.length,
        active: teamMembers.filter((m: { isActive: boolean }) => m.isActive).length,
        members: teamMembers,
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
