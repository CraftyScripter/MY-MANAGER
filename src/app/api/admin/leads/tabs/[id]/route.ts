import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser, checkPermission } from "@/lib/auth";
import { logActivity } from "@/lib/activity";
import { broadcastToTab, broadcastToFile } from "@/lib/sync-events";

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getCurrentUser();
  if (!user || !checkPermission(user, "leads", "write")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  try {
    const { id } = await params;
    const body = await request.json();
    const { name, sortOrder, styling, mergedCells, senderId } = body;

    const existing = await prisma.leadTab.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json({ error: "Tab not found" }, { status: 404 });
    }

    const dataToUpdate: Record<string, unknown> = {};
    if (name !== undefined) dataToUpdate.name = name.trim();
    if (sortOrder !== undefined) dataToUpdate.sortOrder = sortOrder;
    if (styling !== undefined || mergedCells !== undefined) {
      dataToUpdate.mergedCells = styling ?? mergedCells;
    }

    const tab = await prisma.leadTab.update({
      where: { id },
      data: dataToUpdate,
    });

    // Broadcast styling update to real-time subscribers
    if (styling !== undefined || mergedCells !== undefined) {
      broadcastToTab(id, "styling", { styling: tab.mergedCells as Record<string, unknown> }, senderId);
    }

    if (name !== undefined || sortOrder !== undefined) {
      broadcastToFile(existing.fileId, "tabs_changed", { fileId: existing.fileId });
      await logActivity({
        action: "rename_tab",
        section: "leads",
        user,
        details: { tabId: id, oldName: existing.name, newName: tab.name, fileId: existing.fileId },
        req: request,
      });
    }

    return NextResponse.json({ tab });
  } catch (error) {
    console.error("Update tab error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}


export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getCurrentUser();
  if (!user || !checkPermission(user, "leads", "write")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  try {
    const { id } = await params;
    const existing = await prisma.leadTab.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json({ error: "Tab not found" }, { status: 404 });
    }

    // Check if this is the last tab in the file
    const tabCount = await prisma.leadTab.count({
      where: { fileId: existing.fileId },
    });
    if (tabCount <= 1) {
      return NextResponse.json(
        { error: "Cannot delete the last tab. Delete the file instead." },
        { status: 400 }
      );
    }

    // Delete all leads in this tab, then delete the tab
    await prisma.lead.deleteMany({ where: { tabId: id } });
    await prisma.leadTab.delete({ where: { id } });

    await logActivity({
      action: "delete_tab",
      section: "leads",
      user,
      details: { tabId: id, name: existing.name, fileId: existing.fileId },
      req: request,
    });

    broadcastToFile(existing.fileId, "tabs_changed", { fileId: existing.fileId });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Delete tab error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

