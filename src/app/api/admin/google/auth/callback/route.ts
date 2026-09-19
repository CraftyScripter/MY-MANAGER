import { NextResponse } from "next/server";
import { exchangeGoogleCode, getGoogleUserProfile } from "@/lib/google";
import { ensureAppDataFolder, createEncryptedDriveBackup } from "@/lib/google-drive";
import { prisma } from "@/lib/prisma";
import { createAdminToken, createTokenForUser, setAuthCookie, getCurrentUser } from "@/lib/auth";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { code, state } = body;

    if (!code) {
      return NextResponse.json({ error: "Missing authorization code" }, { status: 400 });
    }

    // 1. Exchange OAuth code for tokens
    const tokenData = await exchangeGoogleCode(code);
    const accessToken = tokenData.access_token;
    const refreshToken = tokenData.refresh_token;
    const expiresIn = tokenData.expires_in || 3600;
    const tokenExpiresAt = new Date(Date.now() + expiresIn * 1000);

    // 2. Fetch Google profile
    const profile = await getGoogleUserProfile(accessToken);
    if (!profile || !profile.email) {
      return NextResponse.json({ error: "Failed to retrieve user profile from Google" }, { status: 400 });
    }

    // 3. Determine user ID (logged in user or matching admin/user email)
    const currentUser = await getCurrentUser();
    let userId = currentUser?.id || "admin";

    // If user was logging in via Google from login page
    const adminEmail = process.env.ADMIN_USER || "copy76star76@gmail.com";
    let isMasterAdmin = profile.email.toLowerCase() === adminEmail.toLowerCase();

    if (!currentUser) {
      if (isMasterAdmin) {
        userId = "admin";
        const adminToken = createAdminToken();
        await setAuthCookie(adminToken);
      } else {
        // Check if user exists in database
        let dbUser = await prisma.user.findUnique({
          where: { email: profile.email.toLowerCase() },
        });

        if (!dbUser) {
          // Auto-create or activate user
          dbUser = await prisma.user.create({
            data: {
              email: profile.email.toLowerCase(),
              name: profile.name || profile.email.split("@")[0],
              role: "admin",
              permissions: ["*"],
              isActive: true,
            },
          });
        }
        userId = dbUser.id;
        const userToken = createTokenForUser(dbUser.id, dbUser.role, dbUser.permissions);
        await setAuthCookie(userToken);
      }
    }

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



    // 6. Perform initial encrypted backup to Drive
    try {
      await createEncryptedDriveBackup(userId);
    } catch (backupErr) {
      console.warn("Initial drive backup completed with warning:", backupErr);
    }


    // Log activity
    try {
      await prisma.activityLog.create({
        data: {
          action: "GOOGLE_ACCOUNT_CONNECTED",
          userEmail: profile.email,
          userName: profile.name,
          section: "Google Drive & Sheets",
          details: `Connected Google account ${profile.email} with Drive folder MyManager_AppData`,
        },
      });
    } catch (_) {}

    return NextResponse.json({
      success: true,
      account: {
        id: googleAccount.id,
        email: googleAccount.email,
        name: googleAccount.name,
        picture: googleAccount.picture,
        driveFolderName: googleAccount.driveFolderName,
        lastBackupAt: googleAccount.lastBackupAt,
        lastSyncAt: googleAccount.lastSyncAt,
      },
    });
  } catch (error: any) {
    console.error("Google OAuth callback error:", error);
    return NextResponse.json(
      { error: error?.message || "Failed to complete Google authentication" },
      { status: 500 }
    );
  }
}
