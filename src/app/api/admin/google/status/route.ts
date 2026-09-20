import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { getWorkspaceAdminGoogleAccount } from "@/lib/google";
import { prisma } from "@/lib/prisma";

export async function GET() {
  try {
    const user = await getCurrentUser();
    const workspaceAdminId = user?.workspaceId || user?.id || "admin";
    const isAdmin = Boolean(user?.role === "admin" && !user?.workspaceId);

    const account = await getWorkspaceAdminGoogleAccount(workspaceAdminId);

    if (!account) {
      return NextResponse.json({
        connected: false,
        account: null,
        sheetLinksCount: 0,
        isAdmin,
      });
    }

    const sheetLinksCount = await prisma.googleSheetLink.count({
      where: { userId: workspaceAdminId },
    });

    return NextResponse.json({
      connected: true,
      isAdmin,
      account: {
        id: account.id,
        email: account.email,
        name: account.name,
        picture: account.picture,
        driveFolderName: account.driveFolderName || "MyManager_AppData",
        driveFolderId: account.driveFolderId,
        lastBackupAt: account.lastBackupAt,
        lastSyncAt: account.lastSyncAt,
      },
      sheetLinksCount,
    });
  } catch (error: any) {
    return NextResponse.json(
      { error: error?.message || "Failed to fetch Google status" },
      { status: 500 }
    );
  }
}

