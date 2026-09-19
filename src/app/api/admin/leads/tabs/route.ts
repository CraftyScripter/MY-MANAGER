import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser, checkPermission } from "@/lib/auth";
import { logActivity } from "@/lib/activity";
import { broadcastToFile } from "@/lib/sync-events";

export async function GET(request: Request) {
  const user = await getCurrentUser();
  if (!user || !checkPermission(user, "leads")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  try {
    const { searchParams } = new URL(request.url);
    const fileId = searchParams.get("fileId");

    if (!fileId) {
      return NextResponse.json({ error: "fileId is required" }, { status: 400 });
    }

    const tabs = await prisma.leadTab.findMany({
      where: { fileId },
      include: {
        _count: { select: { leads: true } },
      },
      orderBy: { sortOrder: "asc" },
    });

    return NextResponse.json({ tabs });
  } catch (error) {
    console.error("Fetch tabs error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user || !checkPermission(user, "leads", "write")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  try {
    const body = await request.json();
    const { name, fileId, sourceTabId } = body;

    if (!name || !name.trim()) {
      return NextResponse.json({ error: "Tab name is required" }, { status: 400 });
    }

    if (!fileId) {
      return NextResponse.json({ error: "fileId is required" }, { status: 400 });
    }

    const file = await prisma.leadFile.findUnique({ where: { id: fileId } });
    if (!file) {
      return NextResponse.json({ error: "File not found" }, { status: 404 });
    }

    // Get max sortOrder for this file
    const maxTab = await prisma.leadTab.findFirst({
      where: { fileId },
      orderBy: { sortOrder: "desc" },
      select: { sortOrder: true },
    });

    const tab = await prisma.leadTab.create({
      data: {
        fileId,
        name: name.trim(),
        sortOrder: (maxTab?.sortOrder ?? -1) + 1,
      },
      include: {
        _count: { select: { leads: true } },
      },
    });

    if (sourceTabId) {
      const sourceLeads = await prisma.lead.findMany({ where: { tabId: sourceTabId } });
      if (sourceLeads.length > 0) {
        await prisma.lead.createMany({
          data: sourceLeads.map((l) => ({
            tabId: tab.id,
            businessName: l.businessName,
            phone: l.phone,
            email: l.email,
            address: l.address,
            website: l.website,
            category: l.category,
            rating: l.rating,
            reviews: l.reviews,
            sourceUrl: l.sourceUrl,
            status: l.status,
            notes: l.notes,
            customFields: l.customFields ?? undefined,
          })),
        });
        tab._count.leads = sourceLeads.length;
      }
    }

    await logActivity({
      action: sourceTabId ? "duplicate_tab" : "create_tab",
      section: "leads",
      user,
      details: { tabId: tab.id, name: tab.name, fileId, sourceTabId: sourceTabId || null },
      req: request,
    });

    broadcastToFile(fileId, "tabs_changed", { fileId, tabId: tab.id });

    return NextResponse.json({ tab }, { status: 201 });
  } catch (error) {

    console.error("Create tab error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
