import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser, checkPermission } from "@/lib/auth";

export async function GET(request: Request) {
  const user = await getCurrentUser();
  if (!user || !checkPermission(user, "activity_log")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  try {
    const { searchParams } = new URL(request.url);
    const section = searchParams.get("section");
    const search = searchParams.get("search");
    const page = parseInt(searchParams.get("page") || "1", 10);
    const limit = parseInt(searchParams.get("limit") || "50", 10);
    const skip = (page - 1) * limit;

    const where: Record<string, unknown> = {};

    if (section && section !== "all") {
      where.section = section;
    }

    if (search) {
      where.OR = [
        { action: { contains: search } },
        { userEmail: { contains: search } },
        { userName: { contains: search } },
        { details: { contains: search } },
      ];
    }

    const [activityLogs, totalActivityLogs, paymentLogs, envLogs] = await Promise.all([
      prisma.activityLog.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip,
        take: limit,
      }),
      prisma.activityLog.count({ where }),
      // Also fetch legacy logs if no specific section filter or matching filter
      (!section || section === "all" || section === "finance")
        ? prisma.paymentAuditLog.findMany({
            orderBy: { createdAt: "desc" },
            take: 20,
          })
        : Promise.resolve([]),
      (!section || section === "all" || section === "env")
        ? prisma.envAuditLog.findMany({
            orderBy: { createdAt: "desc" },
            take: 20,
          })
        : Promise.resolve([]),
    ]);

    const formattedActivity = activityLogs.map((l) => ({
      id: l.id,
      action: l.action,
      adminUser: l.userName ? `${l.userName} (${l.userEmail})` : l.userEmail,
      userEmail: l.userEmail,
      userName: l.userName,
      section: l.section,
      details: l.details,
      ipAddress: l.ipAddress,
      createdAt: l.createdAt,
      type: l.section,
    }));

    const formattedPayment = paymentLogs.map((l) => ({
      id: l.id,
      action: l.action,
      adminUser: l.adminUser,
      userEmail: l.adminUser,
      userName: null,
      section: "finance",
      details: l.details,
      ipAddress: null,
      createdAt: l.createdAt,
      type: "finance",
    }));

    const formattedEnv = envLogs.map((l) => ({
      id: l.id,
      action: l.action,
      adminUser: l.adminUser,
      userEmail: l.adminUser,
      userName: null,
      section: "env",
      details: l.details,
      ipAddress: null,
      createdAt: l.createdAt,
      type: "env",
    }));

    // Merge and deduplicate by id
    const seen = new Set<string>();
    const merged = [...formattedActivity, ...formattedPayment, ...formattedEnv]
      .filter((l) => {
        if (seen.has(l.id)) return false;
        seen.add(l.id);
        return true;
      })
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

    const total = Math.max(totalActivityLogs, merged.length);
    const logs = merged.slice(0, limit);

    return NextResponse.json({
      logs,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit) || 1,
      },
    });
  } catch (error) {
    console.error("Fetch activity log error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
