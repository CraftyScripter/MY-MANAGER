import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser, checkPermission } from "@/lib/auth";
import { logActivity } from "@/lib/activity";
import { broadcastGlobal } from "@/lib/sync-events";

interface FolderWithCounts {
  id: string;
  name: string;
  color: string | null;
  parentId: string | null;
  createdAt: Date;
  updatedAt: Date;
  children: FolderWithCounts[];
  _count: { children: number; files: number };
}

async function buildFolderTree(parentId: string | null): Promise<FolderWithCounts[]> {
  const where = parentId
    ? { parentId }
    : { OR: [{ parentId: null }, { parentId: { isSet: false } }] };

  const folders = await prisma.leadFolder.findMany({
    where,
    include: {
      _count: { select: { children: true, files: true } },
    },
    orderBy: { name: "asc" },
  });

  const result: FolderWithCounts[] = [];
  for (const folder of folders) {
    const children = await buildFolderTree(folder.id);
    result.push({ ...folder, children });
  }

  return result;
}

export async function GET(request: Request) {
  const user = await getCurrentUser();
  if (!user || !checkPermission(user, "leads")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  try {
    const rootFolders = await buildFolderTree(null);

    const rootFilesWhere: Record<string, unknown> = {
      OR: [{ folderId: null }, { folderId: { isSet: false } }],
    };

    if (user.role !== "admin") {
      rootFilesWhere.NOT = { hiddenMemberIds: { has: user.id } };
    }

    const rootFiles = await prisma.leadFile.findMany({
      where: rootFilesWhere,
      include: {
        _count: { select: { tabs: true } },
        tabs: {
          include: { _count: { select: { leads: true } } },
          orderBy: { sortOrder: "asc" },
        },
      },
      orderBy: { name: "asc" },
    });

    return NextResponse.json({ folders: rootFolders, rootFiles });
  } catch (error) {
    console.error("Fetch folders error:", error);
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
    const { name, color, parentId } = body;

    if (!name || !name.trim()) {
      return NextResponse.json({ error: "Folder name is required" }, { status: 400 });
    }

    if (parentId) {
      const parent = await prisma.leadFolder.findUnique({ where: { id: parentId } });
      if (!parent) {
        return NextResponse.json({ error: "Parent folder not found" }, { status: 404 });
      }
    }

    const folder = await prisma.leadFolder.create({
      data: {
        name: name.trim(),
        color: color || null,
        parentId: parentId || null,
      },
    });

    await logActivity({
      action: "create_folder",
      section: "leads",
      user,
      details: { folderId: folder.id, name: folder.name, parentId: folder.parentId },
      req: request,
    });

    broadcastGlobal("folder_created", { folderId: folder.id, parentId: folder.parentId });

    return NextResponse.json({ folder }, { status: 201 });
  } catch (error) {

    console.error("Create folder error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
