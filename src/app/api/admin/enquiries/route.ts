import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { recomputeDashboardStats } from "@/lib/stats";
import { getCurrentUser, checkPermission } from "@/lib/auth";
import { logActivity } from "@/lib/activity";

export async function DELETE(request: Request) {
  const user = await getCurrentUser();
  if (!user || !checkPermission(user, "leads", "write")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get("id");

    if (!id) {
      return NextResponse.json(
        { error: "Enquiry ID is required" },
        { status: 400 }
      );
    }

    const existing = await prisma.contactEnquiry.findUnique({
      where: { id },
    });

    if (!existing) {
      return NextResponse.json(
        { error: "Enquiry not found" },
        { status: 404 }
      );
    }

    await prisma.contactEnquiry.delete({ where: { id } });

    recomputeDashboardStats().catch(console.error);

    await logActivity({
      action: "delete_enquiry",
      section: "forms",
      user,
      details: { enquiryId: id, email: existing.email, name: existing.name },
      req: request,
    });

    return NextResponse.json({ success: true });
  } catch (error) {

    console.error("Delete error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

export async function GET(request: Request) {
  const user = await getCurrentUser();
  if (!user || !checkPermission(user, "leads")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  try {
    const { searchParams } = new URL(request.url);
    const platform = searchParams.get("platform");
    const replied = searchParams.get("replied");
    const seen = searchParams.get("seen");
    const search = searchParams.get("search");
    const page = parseInt(searchParams.get("page") || "1", 10);
    const limit = parseInt(searchParams.get("limit") || "20", 10);
    const skip = (page - 1) * limit;

    const where: Record<string, unknown> = {};

    if (platform && platform !== "all") {
      where.platform = platform;
    }

    if (replied === "true") {
      where.replied = true;
    } else if (replied === "false") {
      where.replied = false;
    }

    if (seen === "true") {
      where.seen = true;
    } else if (seen === "false") {
      where.seen = false;
    }

    if (search) {
      where.OR = [
        { name: { contains: search } },
        { email: { contains: search } },
        { message: { contains: search } },
      ];
    }

    const [enquiries, total, platforms] = await Promise.all([
      prisma.contactEnquiry.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip,
        take: limit,
      }),
      prisma.contactEnquiry.count({ where }),
      prisma.contactEnquiry.findMany({
        select: { platform: true },
        distinct: ["platform"],
      }),
    ]);

    return NextResponse.json({
      enquiries,
      platforms: platforms.map((p: { platform: string }) => p.platform),
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    console.error("Fetch error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
