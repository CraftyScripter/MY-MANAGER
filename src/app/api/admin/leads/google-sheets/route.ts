import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { getValidGoogleAccount } from "@/lib/google";
import {
  parseSpreadsheetId,
  getSpreadsheetMetadata,
  syncFromGoogleSheet,
} from "@/lib/google-sheets";
import { prisma } from "@/lib/prisma";
import { broadcastGlobal } from "@/lib/sync-events";

export async function GET(request: Request) {
  try {
    const user = await getCurrentUser();
    const userId = user?.id || "admin";

    let links = await prisma.googleSheetLink.findMany({
      where: {
        userId,
      },
      orderBy: { updatedAt: "desc" },
    });

    // Auto-fix: ensure each link has its own unique LeadFile
    const fileLinkCounts = new Map<string, number>();
    for (const link of links) {
      if (!link.fileId) continue;
      fileLinkCounts.set(link.fileId, (fileLinkCounts.get(link.fileId) || 0) + 1);
    }

    let fixed = false;
    for (const link of links) {
      const hasConflict = link.fileId && (fileLinkCounts.get(link.fileId) || 0) > 1;
      const isOrphan = !link.fileId;

      if (!hasConflict && !isOrphan) continue;

      // Clear fileId so syncFromGoogleSheet creates a fresh file
      if (hasConflict || isOrphan) {
        await prisma.googleSheetLink.update({
          where: { id: link.id },
          data: { fileId: null, tabId: null },
        });
      }
      fixed = true;

      // Let syncFromGoogleSheet create the file and populate it
      try {
        await syncFromGoogleSheet(userId, link.id);
      } catch (e: any) {
        console.warn(`[auto-fix] Sync failed for link ${link.id} (${link.spreadsheetName}):`, e?.message);
      }
    }

    if (fixed) {
      links = await prisma.googleSheetLink.findMany({
        where: { userId },
        orderBy: { updatedAt: "desc" },
      });
    }

    return NextResponse.json({
      links,
      activeLink: links[0] || null,
      success: true,
    });
  } catch (error: any) {
    return NextResponse.json(
      { error: error?.message || "Failed to fetch linked sheets" },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  try {
    const user = await getCurrentUser();
    const userId = user?.id || "admin";

    const account = await getValidGoogleAccount(userId);
    if (!account) {
      return NextResponse.json(
        { error: "Please connect your Google account first before linking a Google Sheet." },
        { status: 401 }
      );
    }

    const body = await request.json();
    const { sheetUrl, tabId, sheetName: customSheetName } = body;

    if (!sheetUrl) {
      return NextResponse.json({ error: "Spreadsheet URL or ID is required" }, { status: 400 });
    }

    const spreadsheetId = parseSpreadsheetId(sheetUrl);
    if (!spreadsheetId) {
      return NextResponse.json({ error: "Invalid Google Sheet URL or ID" }, { status: 400 });
    }

    // 1. Verify sheet exists and fetch title
    const metadata = await getSpreadsheetMetadata(account.accessToken, spreadsheetId);
    const sheetName =
      customSheetName || (metadata.sheets[0] ? metadata.sheets[0].title : "Sheet1");

    // 2. Create or update GoogleSheetLink record
    let link = await prisma.googleSheetLink.findFirst({
      where: {
        userId,
        spreadsheetId,
      },
    });

    if (link) {
      link = await prisma.googleSheetLink.update({
        where: { id: link.id },
        data: {
          spreadsheetName: metadata.title,
          sheetName,
          sheetUrl: sheetUrl.startsWith("http")
            ? sheetUrl
            : `https://docs.google.com/spreadsheets/d/${spreadsheetId}/edit`,
          tabId: tabId || link.tabId,
          syncStatus: "syncing",
          updatedAt: new Date(),
        },
      });
    } else {
      link = await prisma.googleSheetLink.create({
        data: {
          userId,
          spreadsheetId,
          spreadsheetName: metadata.title,
          sheetName,
          sheetUrl: sheetUrl.startsWith("http")
            ? sheetUrl
            : `https://docs.google.com/spreadsheets/d/${spreadsheetId}/edit`,
          tabId: tabId || null,
          syncStatus: "syncing",
        },
      });
    }

    // 3. Immediately trigger initial 2-way sync
    let syncResult = null;
    try {
      syncResult = await syncFromGoogleSheet(userId, link.id);
    } catch (syncErr: any) {
      console.warn("Initial sync error:", syncErr);
    }

    const updatedLink = await prisma.googleSheetLink.findUnique({
      where: { id: link.id },
    });

    return NextResponse.json({
      success: true,
      message: `Google Sheet "${metadata.title}" connected successfully!`,
      link: updatedLink,
      syncResult,
    });
  } catch (error: any) {
    console.error("Link Google Sheet error:", error);
    return NextResponse.json(
      { error: error?.message || "Failed to link Google Sheet" },
      { status: 500 }
    );
  }
}

// Trigger manual sync
export async function PUT(request: Request) {
  try {
    const user = await getCurrentUser();
    const userId = user?.id || "admin";

    const body = await request.json();
    const { linkId } = body;

    if (!linkId) {
      return NextResponse.json({ error: "Missing linkId parameter" }, { status: 400 });
    }

    const syncResult = await syncFromGoogleSheet(userId, linkId);
    const updatedLink = await prisma.googleSheetLink.findUnique({
      where: { id: linkId },
    });

    return NextResponse.json({
      success: true,
      message: "Sync completed successfully",
      syncResult,
      link: updatedLink,
    });
  } catch (error: any) {
    return NextResponse.json(
      { error: error?.message || "Failed to sync Google Sheet" },
      { status: 500 }
    );
  }
}

// Unlink sheet
export async function DELETE(request: Request) {
  try {
    const user = await getCurrentUser();
    const userId = user?.id || "admin";

    const { searchParams } = new URL(request.url);
    const linkId = searchParams.get("linkId");

    if (!linkId) {
      return NextResponse.json({ error: "Missing linkId parameter" }, { status: 400 });
    }

    const link = await prisma.googleSheetLink.findUnique({
      where: { id: linkId },
    });

    await prisma.googleSheetLink.deleteMany({
      where: { id: linkId, userId },
    });

    if (link?.fileId) {
      broadcastGlobal("file_updated", { fileId: link.fileId });
    }

    return NextResponse.json({
      success: true,
      message: "Google Sheet unlinked successfully",
    });
  } catch (error: any) {
    return NextResponse.json(
      { error: error?.message || "Failed to unlink Google Sheet" },
      { status: 500 }
    );
  }
}
