import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser, checkPermission } from "@/lib/auth";
import { logActivity } from "@/lib/activity";
import { broadcastGlobal } from "@/lib/sync-events";

export async function GET(request: Request) {
  const user = await getCurrentUser();
  if (!user || !checkPermission(user, "leads")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  try {
    const { searchParams } = new URL(request.url);
    const folderId = searchParams.get("folderId");

    const where: Record<string, unknown> = {};
    if (folderId) {
      where.folderId = folderId;
    } else {
      where.folderId = null;
    }

    const files = await prisma.leadFile.findMany({
      where,
      include: {
        _count: { select: { tabs: true } },
        tabs: {
          include: { _count: { select: { leads: true } } },
          orderBy: { sortOrder: "asc" },
        },
      },
      orderBy: { name: "asc" },
    });

    return NextResponse.json({ files });
  } catch (error) {
    console.error("Fetch files error:", error);
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
    const { name, description, folderId } = body;

    if (!name || !name.trim()) {
      return NextResponse.json({ error: "File name is required" }, { status: 400 });
    }

    if (folderId) {
      const folder = await prisma.leadFolder.findUnique({ where: { id: folderId } });
      if (!folder) {
        return NextResponse.json({ error: "Folder not found" }, { status: 404 });
      }
    }

    const file = await prisma.leadFile.create({
      data: {
        name: name.trim(),
        description: description || null,
        folderId: folderId || null,
      },
    });

    // Auto-create first tab
    const tab = await prisma.leadTab.create({
      data: {
        fileId: file.id,
        name: "Sheet 1",
        sortOrder: 0,
      },
    });

    await logActivity({
      action: "create_file",
      section: "leads",
      user,
      details: { fileId: file.id, name: file.name, folderId: file.folderId },
      req: request,
    });

    broadcastGlobal("file_created", { fileId: file.id, folderId: file.folderId });

    return NextResponse.json({ file, tab }, { status: 201 });
  } catch (error) {

    console.error("Create file error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
