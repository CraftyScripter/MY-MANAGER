import { NextResponse } from "next/server";
import { exchangeGoogleCode, getGoogleUserProfile } from "@/lib/google";
import { ensureAppDataFolder, createEncryptedDriveBackup } from "@/lib/google-drive";
import { prisma } from "@/lib/prisma";
import { createAdminToken, createTokenForUser, setAuthCookie, getCurrentUser } from "@/lib/auth";

// In-flight map to deduplicate concurrent requests for the same authorization code
const inFlightExchanges = new Map<
  string,
  Promise<{ success: boolean; account?: any; error?: string; status: number }>
>();

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { code, state } = body;

    if (!code) {
      return NextResponse.json({ error: "Missing authorization code" }, { status: 400 });
    }

    // If another request is currently exchanging this exact code, await its outcome
    if (inFlightExchanges.has(code)) {
      const result = await inFlightExchanges.get(code)!;
      return NextResponse.json(
        result.success ? { success: true, account: result.account } : { error: result.error },
        { status: result.status }
      );
    }

    const processExchange = async () => {
      // 1. Exchange OAuth code for tokens
      const tokenData = await exchangeGoogleCode(code);
      const accessToken = tokenData.access_token;
      const refreshToken = tokenData.refresh_token;
      const expiresIn = tokenData.expires_in || 3600;
      const tokenExpiresAt = new Date(Date.now() + expiresIn * 1000);

      // 2. Fetch Google profile
      const profile = await getGoogleUserProfile(accessToken);
      if (!profile || !profile.email) {
        return { success: false, error: "Failed to retrieve user profile from Google", status: 400 };
      }

      // 3. Google Sign-In is ALWAYS for admin (own workspace)
      // Ignore any current workspace membership context
      let dbUser = await prisma.user.findUnique({
        where: { email: profile.email.toLowerCase() },
      });

      if (!dbUser) {
        // Auto-create as admin
        dbUser = await prisma.user.create({
          data: {
            email: profile.email.toLowerCase(),
            name: profile.name || profile.email.split("@")[0],
            role: "admin",
            permissions: ["*"],
            isActive: true,
          },
        });
      } else if (dbUser.role !== "admin") {
        // User exists as team member elsewhere → promote to admin for own workspace
        dbUser = await prisma.user.update({
          where: { id: dbUser.id },
          data: { role: "admin", permissions: ["*"], isActive: true },
        });
      }

      const userId = dbUser.id;
      // Always create admin token (no workspaceId = own workspace)
      const userToken = createTokenForUser(dbUser.id, "admin", ["*"]);
      await setAuthCookie(userToken);

      // 4. Ensure complete dedicated workspace folder tree in Google Drive (AppData, Finance_Proofs, Instagram_Media, Documents)
      let driveFolderId: string | null = null;
      let driveFinanceFolderId: string | null = null;
      let driveInstagramFolderId: string | null = null;
      let driveDocsFolderId: string | null = null;

      try {
        const { ensureWorkspaceFolderTree } = await import("@/lib/googleDriveService");
        const folderTree = await ensureWorkspaceFolderTree({
          id: "temp",
          accessToken,
        });
        driveFolderId = folderTree.rootFolderId;
        driveFinanceFolderId = folderTree.financeFolderId;
        driveInstagramFolderId = folderTree.instagramFolderId;
        driveDocsFolderId = folderTree.docsFolderId;
      } catch (folderErr) {
        console.warn("Could not ensure workspace folder tree in Drive:", folderErr);
        try {
          driveFolderId = await ensureAppDataFolder(accessToken, "MyManager_AppData");
        } catch (_) {}
      }

      // 5. Upsert GoogleAccount in database
      const coreUpdate: any = {
        userId,
        email: profile.email,
        name: profile.name,
        picture: profile.picture,
        accessToken,
        ...(refreshToken ? { refreshToken } : {}),
        tokenExpiresAt,
        scope: tokenData.scope,
        driveFolderId: driveFolderId || undefined,
        driveFolderName: "MyManager_AppData",
        lastSyncAt: new Date(),
        updatedAt: new Date(),
      };

      const coreCreate: any = {
        userId,
        googleId: profile.id,
        email: profile.email,
        name: profile.name,
        picture: profile.picture,
        accessToken,
        refreshToken,
        tokenExpiresAt,
        scope: tokenData.scope,
        driveFolderId: driveFolderId || undefined,
        driveFolderName: "MyManager_AppData",
        lastSyncAt: new Date(),
      };

      const googleAccount = await prisma.googleAccount.upsert({
        where: { googleId: profile.id },
        update: coreUpdate,
        create: coreCreate,
      });

      // 6. Perform initial encrypted backup to Drive in background (non-blocking for fast UI response)
      createEncryptedDriveBackup(userId).catch((backupErr) => {
        console.warn("Initial drive backup completed with warning:", backupErr);
      });

      // Account setup event — not logged to activity log (not a meaningful audit event)

      return {
        success: true,
        status: 200,
        account: {
          id: googleAccount.id,
          email: googleAccount.email,
          name: googleAccount.name,
          picture: googleAccount.picture,
          driveFolderName: googleAccount.driveFolderName,
          lastBackupAt: googleAccount.lastBackupAt,
          lastSyncAt: googleAccount.lastSyncAt,
        },
      };
    };

    const task = processExchange();
    inFlightExchanges.set(code, task);

    try {
      const result = await task;
      return NextResponse.json(
        result.success ? { success: true, account: result.account } : { error: result.error },
        { status: result.status }
      );
    } finally {
      // Clear after 15 seconds so late duplicate requests can latch on without leaking memory
      setTimeout(() => {
        inFlightExchanges.delete(code);
      }, 15000);
    }
  } catch (error: any) {
    const message = error?.message || "Failed to complete Google authentication";
    const isInvalidGrant = message.includes("invalid_grant");

    if (isInvalidGrant) {
      console.warn("Google OAuth code exchange warning (code already used or expired):", message);
      return NextResponse.json(
        { error: "Authorization code has already been used or has expired. Please try signing in again." },
        { status: 400 }
      );
    }

    console.error("Google OAuth callback error:", error);
    return NextResponse.json(
      { error: message },
      { status: 500 }
    );
  }
}
