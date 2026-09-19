import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser, checkPermission } from "@/lib/auth";
import { logActivity } from "@/lib/activity";
import { broadcastGlobal } from "@/lib/sync-events";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getCurrentUser();
  if (!user || !checkPermission(user, "leads")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  try {
    const { id } = await params;
    const file = await prisma.leadFile.findUnique({
      where: { id },
      include: {
        _count: { select: { tabs: true } },
        tabs: {
          include: { _count: { select: { leads: true } } },
          orderBy: { sortOrder: "asc" },
        },
        columns: {
          orderBy: { sortOrder: "asc" },
        },
      },
    });

    if (!file) {
      return NextResponse.json({ error: "File not found" }, { status: 404 });
    }

    return NextResponse.json({ file });
  } catch (error) {
    console.error("Fetch file error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

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
    const { name, description, folderId } = body;

    const existing = await prisma.leadFile.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json({ error: "File not found" }, { status: 404 });
    }

    if (folderId && folderId !== existing.folderId) {
      const folderExists = await prisma.leadFolder.findUnique({ where: { id: folderId } });
      if (!folderExists) {
        return NextResponse.json({ error: "Target folder not found" }, { status: 404 });
      }
    }

    const file = await prisma.leadFile.update({
      where: { id },
      data: {
        name: name !== undefined ? name.trim() : existing.name,
        description: description !== undefined ? description : existing.description,
        folderId: folderId !== undefined ? folderId : existing.folderId,
      },
    });

    await logActivity({
      action: "update_file",
      section: "leads",
      user,
      details: { fileId: id, name: file.name },
      req: request,
    });

    broadcastGlobal("file_updated", { fileId: id, name: file.name, folderId: file.folderId });

    return NextResponse.json({ file });
  } catch (error) {
    console.error("Update file error:", error);
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
    const existing = await prisma.leadFile.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json({ error: "File not found" }, { status: 404 });
    }

    // Delete all tabs and their leads
    const tabs = await prisma.leadTab.findMany({
      where: { fileId: id },
      select: { id: true },
    });
    for (const tab of tabs) {
      await prisma.lead.deleteMany({ where: { tabId: tab.id } });
    }
    await prisma.leadTab.deleteMany({ where: { fileId: id } });
    await prisma.leadColumn.deleteMany({ where: { fileId: id } });
    await prisma.leadFile.delete({ where: { id } });

    await logActivity({
      action: "delete_file",
      section: "leads",
      user,
      details: { fileId: id, name: existing.name },
      req: request,
    });

    broadcastGlobal("file_deleted", { fileId: id, folderId: existing.folderId });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Delete file error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

