import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser, checkPermission } from "@/lib/auth";
import { logActivity } from "@/lib/activity";
import { broadcastGlobal } from "@/lib/sync-events";
import { getWorkspaceAdminGoogleAccount } from "@/lib/google";
import { createGoogleSpreadsheet, ensureSheetHeaders } from "@/lib/google-sheets";

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
      where.OR = [{ folderId: null }, { folderId: { isSet: false } }];
    }

    // For team members (non-admin), filter out hidden files
    if (user.role !== "admin") {
      // Exclude files where user's ID is in hiddenMemberIds
      const existingAnd = (where.AND as unknown[]) || [];
      where.AND = [
        ...existingAnd,
        { NOT: { hiddenMemberIds: { has: user.id } } },
      ];
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
    const { name, description, folderId, syncWithGoogleSheet } = body;

    if (!name || !name.trim()) {
      return NextResponse.json({ error: "File name is required" }, { status: 400 });
    }

    if (folderId) {
      const folder = await prisma.leadFolder.findUnique({ where: { id: folderId } });
      if (!folder) {
        return NextResponse.json({ error: "Folder not found" }, { status: 404 });
      }
    }

    let initialDescription = description || null;
    let googleSheetUrl: string | null = null;

    let file = await prisma.leadFile.create({
      data: {
        name: name.trim(),
        description: initialDescription,
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

    // If syncWithGoogleSheet is enabled, create spreadsheet on Google Drive and link it
    if (syncWithGoogleSheet) {
      try {
        const workspaceAdminId = user.workspaceId || user.id;
        const account = await getWorkspaceAdminGoogleAccount(workspaceAdminId);
        if (account && account.accessToken) {
          const newSheet = await createGoogleSpreadsheet(
            account.accessToken,
            name.trim(),
            "Sheet 1"
          );
          googleSheetUrl = newSheet.spreadsheetUrl;

          await ensureSheetHeaders(account.accessToken, newSheet.spreadsheetId, "Sheet 1").catch(() => {});

          await prisma.googleSheetLink.create({
            data: {
              userId: workspaceAdminId,
              fileId: file.id,
              tabId: tab.id,
              spreadsheetId: newSheet.spreadsheetId,
              spreadsheetName: name.trim(),
              sheetName: "Sheet 1",
              sheetUrl: newSheet.spreadsheetUrl,
              syncStatus: "success",
              lastSyncedAt: new Date(),
            },
          });

          const updatedDesc = description
            ? `${description} • Google Sheet (Live Sync)`
            : `Google Sheet (Live Sync) • 1 tab`;

          file = await prisma.leadFile.update({
            where: { id: file.id },
            data: { description: updatedDesc },
          });
        }
      } catch (sheetErr) {
        console.warn("Could not automatically create Google Sheet on Google Drive:", sheetErr);
      }
    }

    await logActivity({
      action: "create_file",
      section: "leads",
      user,
      details: { fileId: file.id, name: file.name, folderId: file.folderId, googleSheetUrl },
      req: request,
    });

    broadcastGlobal("file_created", { fileId: file.id, folderId: file.folderId });

    return NextResponse.json({ file, tab, googleSheetUrl }, { status: 201 });
  } catch (error) {
    console.error("Create file error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
