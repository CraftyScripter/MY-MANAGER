import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser, checkPermission } from "@/lib/auth";
import { logActivity } from "@/lib/activity";
import { broadcastGlobal } from "@/lib/sync-events";

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
    const { name, color, parentId } = body;

    const existing = await prisma.leadFolder.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json({ error: "Folder not found" }, { status: 404 });
    }

    let updatedParentId = existing.parentId;
    if (parentId !== undefined) {
      if (parentId === id) {
        return NextResponse.json({ error: "A folder cannot be its own parent" }, { status: 400 });
      }
      if (parentId !== null && parentId !== "") {
        const parentFolder = await prisma.leadFolder.findUnique({ where: { id: parentId } });
        if (!parentFolder) {
          return NextResponse.json({ error: "Parent folder not found" }, { status: 404 });
        }
        // Check if parentId is a descendant of id to prevent cycles
        async function isDescendant(targetId: string, currentId: string): Promise<boolean> {
          const children = await prisma.leadFolder.findMany({
            where: { parentId: currentId },
            select: { id: true },
          });
          for (const child of children) {
            if (child.id === targetId) return true;
            if (await isDescendant(targetId, child.id)) return true;
          }
          return false;
        }

        if (await isDescendant(parentId, id)) {
          return NextResponse.json({ error: "Cannot move a folder into its own subfolder" }, { status: 400 });
        }
        updatedParentId = parentId;
      } else {
        updatedParentId = null;
      }
    }

    const folder = await prisma.leadFolder.update({
      where: { id },
      data: {
        name: name !== undefined ? name.trim() : existing.name,
        color: color !== undefined ? color : existing.color,
        parentId: updatedParentId,
      },
    });

    await logActivity({
      action: "update_folder",
      section: "leads",
      user,
      details: { folderId: id, name: folder.name },
      req: request,
    });

    broadcastGlobal("folder_updated", { folderId: id, name: folder.name, parentId: folder.parentId });

    return NextResponse.json({ folder });
  } catch (error) {
    console.error("Update folder error:", error);
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
    const existing = await prisma.leadFolder.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json({ error: "Folder not found" }, { status: 404 });
    }

    // Get all descendant folder IDs to delete
    async function getAllDescendantIds(folderId: string): Promise<string[]> {
      const children = await prisma.leadFolder.findMany({
        where: { parentId: folderId },
        select: { id: true },
      });
      const ids = [folderId];
      for (const child of children) {
        const childIds = await getAllDescendantIds(child.id);
        ids.push(...childIds);
      }
      return ids;
    }

    const allFolderIds = await getAllDescendantIds(id);

    // Find all files inside any of these folders
    const files = await prisma.leadFile.findMany({
      where: { folderId: { in: allFolderIds } },
      select: { id: true },
    });
    const fileIds = files.map((f) => f.id);

    if (fileIds.length > 0) {
      // Find all tabs for these files
      const tabs = await prisma.leadTab.findMany({
        where: { fileId: { in: fileIds } },
        select: { id: true },
      });
      const tabIds = tabs.map((t) => t.id);

      if (tabIds.length > 0) {
        await prisma.lead.deleteMany({ where: { tabId: { in: tabIds } } });
        await prisma.leadTab.deleteMany({ where: { id: { in: tabIds } } });
      }
      await prisma.leadColumn.deleteMany({ where: { fileId: { in: fileIds } } });
      await prisma.leadFile.deleteMany({ where: { id: { in: fileIds } } });
    }

    // Unlink any parentId references to prevent relation constraint issues
    await prisma.leadFolder.updateMany({
      where: { parentId: { in: allFolderIds } },
      data: { parentId: null },
    });

    // Delete all descendant folders and the target folder
    await prisma.leadFolder.deleteMany({
      where: { id: { in: allFolderIds } },
    });

    await logActivity({
      action: "delete_folder",
      section: "leads",
      user,
      details: { folderId: id, name: existing.name },
      req: request,
    });

    broadcastGlobal("folder_deleted", { folderId: id, deletedFolderIds: allFolderIds, deletedFileIds: fileIds });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Delete folder error:", error);
    const message = error instanceof Error ? error.message : "Internal server error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

