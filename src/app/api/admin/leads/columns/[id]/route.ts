import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser, checkPermission } from "@/lib/auth";
import { logActivity } from "@/lib/activity";
import { broadcastToFile } from "@/lib/sync-events";

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
    const { name, type, options, sortOrder, width, senderId } = body;

    const existing = await prisma.leadColumn.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json({ error: "Column not found" }, { status: 404 });
    }

    const newName = name !== undefined ? name.trim() : existing.name;
    const column = await prisma.leadColumn.update({
      where: { id },
      data: {
        name: newName,
        type: type !== undefined ? type : existing.type,
        options: options !== undefined ? options : existing.options,
        sortOrder: sortOrder !== undefined ? sortOrder : existing.sortOrder,
        width: width !== undefined ? width : existing.width,
      },
    });

    if (name && name.trim() !== existing.name) {
      const tabs = await prisma.leadTab.findMany({
        where: { fileId: existing.fileId },
        select: { id: true },
      });

      for (const tab of tabs) {
        const leads = await prisma.lead.findMany({
          where: { tabId: tab.id, customFields: { not: null } },
          select: { id: true, customFields: true },
        });

        for (const lead of leads) {
          const fields = (lead.customFields as Record<string, string>) || {};
          if (fields[existing.name] !== undefined) {
            fields[newName] = fields[existing.name];
            delete fields[existing.name];
            await prisma.lead.update({
              where: { id: lead.id },
              data: { customFields: Object.keys(fields).length > 0 ? fields : null },
            });
          }
        }
      }
    }

    await logActivity({
      action: "update_column",
      section: "leads",
      user,
      details: { columnId: id, name: column.name, type: column.type, fileId: existing.fileId },
      req: request,
    });

    broadcastToFile(existing.fileId, "columns_changed", { fileId: existing.fileId, column, action: "update" }, senderId);

    return NextResponse.json({ column });
  } catch (error) {
    console.error("Update column error:", error);
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
    const existing = await prisma.leadColumn.findUnique({ where: { id } });
    if (!existing) {
      // If already removed from database, return success so frontend state cleans up cleanly
      return NextResponse.json({ success: true, message: "Column was already deleted" });
    }

    // Remove this column's data from all leads in the file's tabs
    const tabs = await prisma.leadTab.findMany({
      where: { fileId: existing.fileId },
      select: { id: true },
    });

    const existingLower = existing.name.toLowerCase().trim();

    for (const tab of tabs) {
      const leads = await prisma.lead.findMany({
        where: { tabId: tab.id, customFields: { not: null } },
        select: { id: true, customFields: true },
      });

      for (const lead of leads) {
        const fields = (lead.customFields as Record<string, string>) || {};
        let changed = false;
        for (const k of Object.keys(fields)) {
          if (k.toLowerCase().trim() === existingLower || k === existing.name) {
            delete fields[k];
            changed = true;
          }
        }
        if (changed) {
          await prisma.lead.update({
            where: { id: lead.id },
            data: { customFields: Object.keys(fields).length > 0 ? fields : null },
          });
        }
      }
    }

    // Delete this column and any duplicates with the same name in the same file
    await prisma.leadColumn.deleteMany({
      where: {
        fileId: existing.fileId,
        name: existing.name,
      },
    });

    await logActivity({
      action: "delete_column",
      section: "leads",
      user,
      details: { columnId: id, name: existing.name, fileId: existing.fileId },
      req: request,
    });

    broadcastToFile(existing.fileId, "columns_changed", { fileId: existing.fileId, columnId: id, action: "delete" });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Delete column error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

