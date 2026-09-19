import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser, checkPermission } from "@/lib/auth";
import { logActivity } from "@/lib/activity";
import { broadcastToTab } from "@/lib/sync-events";
import { pushLeadToGoogleSheet } from "@/lib/google-sheets";


export async function GET(request: Request) {
  const user = await getCurrentUser();
  if (!user || !checkPermission(user, "leads")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  try {
    const { searchParams } = new URL(request.url);
    const tabId = searchParams.get("tabId");
    const status = searchParams.get("status");
    const category = searchParams.get("category");
    const search = searchParams.get("search");
    const page = parseInt(searchParams.get("page") || "1", 10);
    const limit = parseInt(searchParams.get("limit") || "500", 10);
    const skip = (page - 1) * limit;

    if (!tabId) {
      return NextResponse.json({ error: "tabId is required" }, { status: 400 });
    }

    const where: Record<string, unknown> = { tabId };

    if (status && status !== "all") {
      where.status = status;
    }

    if (category && category !== "all") {
      where.category = category;
    }

    if (search) {
      where.OR = [
        { businessName: { contains: search } },
        { email: { contains: search } },
        { phone: { contains: search } },
        { address: { contains: search } },
      ];
    }

    const [leads, total, categories] = await Promise.all([
      prisma.lead.findMany({
        where,
        orderBy: { createdAt: "asc" },
        skip,
        take: limit,
      }),
      prisma.lead.count({ where }),
      prisma.lead.findMany({
        select: { category: true },
        distinct: ["category"],
        where: { tabId, category: { not: null } },
      }),
    ]);

    return NextResponse.json({
      leads,
      categories: categories.map((c: { category: string | null }) => c.category).filter(Boolean),
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    console.error("Fetch leads error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user || !checkPermission(user, "leads", "write")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  try {
    const body = await request.json();
    const { tabId, businessName, phone, email, address, website, category, rating, reviews, sourceUrl, notes, customFields } = body;

    if (!tabId) {
      return NextResponse.json({ error: "tabId is required" }, { status: 400 });
    }

    const tab = await prisma.leadTab.findUnique({ where: { id: tabId } });
    if (!tab) {
      return NextResponse.json({ error: "Tab not found" }, { status: 404 });
    }

    const lead = await prisma.lead.create({
      data: {
        tabId,
        businessName: businessName || "",
        phone: phone || null,
        email: email || null,
        address: address || null,
        website: website || null,
        category: category || null,
        rating: rating ? parseFloat(rating) : null,
        reviews: reviews ? parseInt(reviews) : null,
        sourceUrl: sourceUrl || null,
        status: body.status !== undefined ? body.status : "",
        notes: notes || null,
        customFields: customFields || null,
      },
    });



    // Broadcast lead addition to live subscribers
    broadcastToTab(tabId, "lead_added", { lead }, body.senderId);

    // Non-blocking Google Sheet live sync push
    pushLeadToGoogleSheet(user.id, tabId, lead).catch((e) =>
      console.warn("Failed async push to Google Sheet:", e)
    );

    await logActivity({
      action: "create_lead",
      section: "leads",
      user,
      details: { leadId: lead.id, tabId, businessName: lead.businessName },
      req: request,
    });


    return NextResponse.json({ lead }, { status: 201 });

  } catch (error) {
    console.error("Create lead error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
