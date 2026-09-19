import { prisma } from "./prisma";

export async function recomputeDashboardStats(): Promise<void> {
  try {
    const [contactEnquiries, toolEnquiries, credentialCount, payments] =
      await Promise.all([
        prisma.contactEnquiry.findMany({
          select: {
            platform: true,
            replied: true,
            seen: true,
            createdAt: true,
          },
        }),
        prisma.promiseMeEnquiry.findMany({
          select: {
            replied: true,
            seen: true,
            createdAt: true,
          },
        }),
        prisma.credential.count(),
        prisma.payment.findMany({
          select: { type: true, amount: true, status: true },
        }),
      ]);

    const totalContacts = contactEnquiries.length;
    const totalTools = toolEnquiries.length;
    const total = totalContacts + totalTools;

    const repliedContacts = contactEnquiries.filter((e) => e.replied).length;
    const repliedTools = toolEnquiries.filter((e) => e.replied).length;
    const replied = repliedContacts + repliedTools;
    const pending = total - replied;

    const seenContacts = contactEnquiries.filter((e) => e.seen).length;
    const seenTools = toolEnquiries.filter((e) => e.seen).length;
    const seen = seenContacts + seenTools;

    const platformMap = new Map<string, number>();
    contactEnquiries.forEach((e) => {
      platformMap.set(e.platform, (platformMap.get(e.platform) || 0) + 1);
    });
    const platformDistribution = Array.from(platformMap.entries()).map(
      ([name, value]) => ({ name, value })
    );

    const now = new Date();
    const dayMap = new Map<string, { total: number; replied: number }>();

    const addDay = (
      d: Date,
      replied: boolean
    ) => {
      const key = d.toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
      });
      const entry = dayMap.get(key) || { total: 0, replied: 0 };
      entry.total += 1;
      if (replied) entry.replied += 1;
      dayMap.set(key, entry);
    };

    contactEnquiries.forEach((e) => addDay(new Date(e.createdAt), e.replied));
    toolEnquiries.forEach((e) => addDay(new Date(e.createdAt), e.replied));

    const dailyData: { date: string; total: number; replied: number }[] = [];
    for (let i = 6; i >= 0; i--) {
      const day = new Date(now);
      day.setDate(now.getDate() - i);
      const key = day.toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
      });
      const entry = dayMap.get(key) || { total: 0, replied: 0 };
      dailyData.push({ date: key, total: entry.total, replied: entry.replied });
    }

    let totalIncome = 0;
    let totalExpenses = 0;
    let totalRefunds = 0;
    let pendingAmount = 0;

    for (const p of payments) {
      const amt = parseFloat(p.amount) || 0;
      if (p.status === "Pending") {
        pendingAmount += amt;
      } else if (p.status === "Completed") {
        if (p.type === "Income") totalIncome += amt;
        else if (p.type === "Expense") totalExpenses += amt;
        else if (p.type === "Refund") totalRefunds += amt;
      }
    }

    const netBalance = totalIncome - totalExpenses - totalRefunds;

    await prisma.dashboardSnapshot.upsert({
      where: { id: "default" },
      create: {
        id: "default",
        totalEnquiries: total,
        repliedEnquiries: replied,
        pendingEnquiries: pending,
        seenEnquiries: seen,
        replyRate: total > 0 ? Math.round((replied / total) * 100) : 0,
        seenRate: replied > 0 ? Math.round((seen / replied) * 100) : 0,
        platformDistribution: JSON.stringify(platformDistribution),
        dailyData: JSON.stringify(dailyData),
        totalCredentials: credentialCount,
        totalIncome: parseFloat(totalIncome.toFixed(2)),
        totalExpenses: parseFloat(totalExpenses.toFixed(2)),
        totalRefunds: parseFloat(totalRefunds.toFixed(2)),
        netBalance: parseFloat(netBalance.toFixed(2)),
        pendingAmount: parseFloat(pendingAmount.toFixed(2)),
      },
      update: {
        lastUpdated: new Date(),
        totalEnquiries: total,
        repliedEnquiries: replied,
        pendingEnquiries: pending,
        seenEnquiries: seen,
        replyRate: total > 0 ? Math.round((replied / total) * 100) : 0,
        seenRate: replied > 0 ? Math.round((seen / replied) * 100) : 0,
        platformDistribution: JSON.stringify(platformDistribution),
        dailyData: JSON.stringify(dailyData),
        totalCredentials: credentialCount,
        totalIncome: parseFloat(totalIncome.toFixed(2)),
        totalExpenses: parseFloat(totalExpenses.toFixed(2)),
        totalRefunds: parseFloat(totalRefunds.toFixed(2)),
        netBalance: parseFloat(netBalance.toFixed(2)),
        pendingAmount: parseFloat(pendingAmount.toFixed(2)),
      },
    });
  } catch (error) {
    console.error("Failed to recompute dashboard stats:", error);
  }
}
