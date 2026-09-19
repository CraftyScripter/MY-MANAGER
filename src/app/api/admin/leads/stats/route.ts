import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser, checkPermission } from "@/lib/auth";

export async function GET(request: Request) {
  const user = await getCurrentUser();
  if (!user || !checkPermission(user, "leads")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  try {
    const { searchParams } = new URL(request.url);
    const tabId = searchParams.get("tabId");

    if (!tabId) {
      return NextResponse.json({ error: "tabId is required" }, { status: 400 });
    }

    const tab = await prisma.leadTab.findUnique({
      where: { id: tabId },
      include: { file: true },
    });
    if (!tab) {
      return NextResponse.json({ error: "Tab not found" }, { status: 404 });
    }

    const [
      totalLeads,
      statusCounts,
      categoryCounts,
      ratingDistribution,
      importedVsManual,
      recentImports,
    ] = await Promise.all([
      prisma.lead.count({ where: { tabId } }),
      prisma.lead.groupBy({
        by: ["status"],
        where: { tabId },
        _count: { id: true },
      }),
      prisma.lead.groupBy({
        by: ["category"],
        where: { tabId, category: { not: null } },
        _count: { id: true },
      }),
      prisma.lead.findMany({
        where: { tabId, rating: { not: null } },
        select: { rating: true },
      }),
      prisma.lead.groupBy({
        by: ["importedAt"],
        where: { tabId },
        _count: { id: true },
        orderBy: { importedAt: "asc" },
      }),
      prisma.lead.findMany({
        where: { tabId },
        orderBy: { createdAt: "desc" },
        take: 5,
        select: { businessName: true, status: true, createdAt: true },
      }),
    ]);

    // Process status distribution
    const statusDistribution = statusCounts.map((item) => ({
      name: item.status,
      value: item._count.id,
    }));

    // Process category breakdown
    const categoryBreakdown = categoryCounts.map((item) => ({
      name: item.category || "Uncategorized",
      value: item._count.id,
    }));

    // Process rating distribution
    const ratingBuckets = { "1-2": 0, "2-3": 0, "3-4": 0, "4-5": 0 };
    ratingDistribution.forEach((item) => {
      if (item.rating !== null) {
        if (item.rating < 2) ratingBuckets["1-2"]++;
        else if (item.rating < 3) ratingBuckets["2-3"]++;
        else if (item.rating < 4) ratingBuckets["3-4"]++;
        else ratingBuckets["4-5"]++;
      }
    });
    const ratingData = Object.entries(ratingBuckets).map(([name, value]) => ({ name, value }));

    // Process import timeline (group by date)
    const importTimeline = importedVsManual.map((item) => ({
      date: item.importedAt.toISOString().split("T")[0],
      count: item._count.id,
    }));

    return NextResponse.json({
      totalLeads,
      statusDistribution,
      categoryBreakdown,
      ratingData,
      importTimeline,
      recentImports,
    });
  } catch (error) {
    console.error("Fetch stats error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
