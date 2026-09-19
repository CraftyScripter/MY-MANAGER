import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET() {
  try {
    const user = await getCurrentUser();
    const userId = user?.id || "admin";

    const links = await prisma.googleSheetLink.findMany({
      where: { userId },
      orderBy: { updatedAt: "desc" },
    });

    const files = await prisma.leadFile.findMany({
      where: { folderId: null },
      include: {
        _count: { select: { tabs: true } },
        tabs: { select: { id: true, name: true, _count: { select: { leads: true } } } },
      },
    });

    // Check which links point to which files
    const linkDetails = links.map((l) => ({
      id: l.id,
      spreadsheetId: l.spreadsheetId,
      spreadsheetName: l.spreadsheetName,
      fileId: l.fileId,
      syncStatus: l.syncStatus,
      lastError: l.lastError,
      lastSyncedAt: l.lastSyncedAt,
    }));

    const fileDetails = files.map((f) => ({
      id: f.id,
      name: f.name,
      description: f.description,
      tabCount: f._count.tabs,
      tabs: f.tabs.map((t) => ({ id: t.id, name: t.name, leadCount: t._count.leads })),
    }));

    // Detect issues
    const issues: string[] = [];
    const fileIds = new Set(links.filter((l) => l.fileId).map((l) => l.fileId));
    const orphanLinks = links.filter((l) => !l.fileId);
    const sharedFileLinks = links.filter((l) => {
      if (!l.fileId) return false;
      return links.filter((l2) => l2.fileId === l.fileId).length > 1;
    });
    const orphanFiles = files.filter((f) => !links.some((l) => l.fileId === f.id));

    if (orphanLinks.length > 0) {
      issues.push(`${orphanLinks.length} link(s) have no fileId (orphan links)`);
    }
    if (sharedFileLinks.length > 0) {
      issues.push(`${sharedFileLinks.length} link(s) share the same fileId`);
    }
    if (orphanFiles.length > 0) {
      issues.push(`${orphanFiles.length} file(s) have no link pointing to them (orphan files)`);
    }

    return NextResponse.json({
      userId,
      linkCount: links.length,
      fileCount: files.length,
      links: linkDetails,
      files: fileDetails,
      issues,
    });
  } catch (error: any) {
    return NextResponse.json(
      { error: error?.message || "Debug failed" },
      { status: 500 }
    );
  }
}
