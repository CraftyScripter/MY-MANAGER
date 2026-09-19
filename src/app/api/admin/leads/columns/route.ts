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

    const columns = await prisma.leadColumn.findMany({
      where: { fileId },
      orderBy: { sortOrder: "asc" },
    });

    return NextResponse.json({ columns });
  } catch (error) {
    console.error("Fetch columns error:", error);
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
    const { name, fileId, type, options } = body;

    if (!name || !name.trim()) {
      return NextResponse.json({ error: "Column name is required" }, { status: 400 });
    }

    if (!fileId) {
      return NextResponse.json({ error: "fileId is required" }, { status: 400 });
    }

    const file = await prisma.leadFile.findUnique({ where: { id: fileId } });
    if (!file) {
      return NextResponse.json({ error: "File not found" }, { status: 404 });
    }

    const maxCol = await prisma.leadColumn.findFirst({
      where: { fileId },
      orderBy: { sortOrder: "desc" },
      select: { sortOrder: true },
    });

    const column = await prisma.leadColumn.create({
      data: {
        fileId,
        name: name.trim(),
        type: type || "text",
        options: options || null,
        sortOrder: (maxCol?.sortOrder ?? -1) + 1,
      },
    });

    await logActivity({
      action: "create_column",
      section: "leads",
      user,
      details: { columnId: column.id, name: column.name, type: column.type, fileId },
      req: request,
    });

    broadcastToFile(fileId, "columns_changed", { fileId, column, action: "create" }, body.senderId);

    return NextResponse.json({ column }, { status: 201 });

  } catch (error) {
    console.error("Create column error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
