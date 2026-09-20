import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser, getEffectiveWorkspaceAdminId } from "@/lib/auth";
import { uploadToAdminDrive } from "@/lib/googleDriveService";
import { getWorkspaceAdminGoogleAccount, getValidGoogleAccount } from "@/lib/google";
import fs from "fs";
import path from "path";

export async function POST(request: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const formData = await request.formData();
    const file = formData.get("file") as File | null;

    if (!file) {
      return NextResponse.json({ error: "No file provided" }, { status: 400 });
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    const isVideo = file.type.startsWith("video/") || Boolean(file.name.match(/\.(mp4|mov|webm)$/i));
    const resourceType = isVideo ? "video" : "image";
    const mimeType = file.type || (isVideo ? "video/mp4" : "image/jpeg");

    const timestamp = Date.now();
    const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
    const uniqueFilename = `${timestamp}_${safeName}`;

    // Resolve public origin for URLs:
    let publicOrigin = "";
    if (process.env.INSTAGRAM_REDIRECT_URI) {
      try {
        const tunnelUrl = new URL(process.env.INSTAGRAM_REDIRECT_URI);
        if (tunnelUrl.hostname && !tunnelUrl.hostname.includes("localhost")) {
          publicOrigin = tunnelUrl.origin;
        }
      } catch {}
    }

    if (!publicOrigin && process.env.NEXT_PUBLIC_APP_URL && !process.env.NEXT_PUBLIC_APP_URL.includes("localhost")) {
      publicOrigin = process.env.NEXT_PUBLIC_APP_URL;
    }

    if (!publicOrigin) {
      const host = request.headers.get("x-forwarded-host") || request.headers.get("host") || "localhost:3000";
      const proto = request.headers.get("x-forwarded-proto") || (host.includes("localhost") ? "http" : "https");
      publicOrigin = `${proto}://${host}`;
    }

    const workspaceId = getEffectiveWorkspaceAdminId(user);

    // 1. Primary Storage: Workspace Admin's Google Drive (inside MyManager_AppData/Instagram_Media)
    try {
      const googleAccount =
        (await getWorkspaceAdminGoogleAccount(workspaceId)) ||
        (await getValidGoogleAccount(workspaceId));

      if (googleAccount) {
        const driveFile = await uploadToAdminDrive({
          fileName: uniqueFilename,
          mimeType,
          buffer,
          folderCategory: "instagram",
          makePublicReadable: true,
          preferredUserId: workspaceId,
        });

        if (driveFile?.fileId) {
          const streamUrl = `${publicOrigin}/api/public/media/${driveFile.fileId}?adminId=${workspaceId}`;
          return NextResponse.json({
            url: streamUrl,
            driveFileId: driveFile.fileId,
            webViewLink: driveFile.webViewLink,
            publicId: driveFile.fileId,
            resourceType,
            fileName: file.name,
            fileSize: file.size,
            source: "google_drive",
            folder: "Instagram_Media",
          });
        }
      }
    } catch (driveErr: any) {
      console.warn("Google Drive upload attempt failed, falling back to local storage:", driveErr?.message);
    }

    // 2. Fallback: Local file system storage (only if Google Drive not yet connected or token expired)
    const uploadsDir = path.join(process.cwd(), "public", "uploads", "instagram");
    if (!fs.existsSync(uploadsDir)) {
      fs.mkdirSync(uploadsDir, { recursive: true });
    }

    const filePath = path.join(uploadsDir, uniqueFilename);
    await fs.promises.writeFile(filePath, buffer);

    const publicUrl = `${publicOrigin}/uploads/instagram/${uniqueFilename}`;
    const relativeUrl = `/uploads/instagram/${uniqueFilename}`;

    return NextResponse.json({
      url: publicUrl,
      localUrl: relativeUrl,
      publicId: uniqueFilename,
      resourceType,
      fileName: file.name,
      fileSize: file.size,
      source: "local",
      notice: "Stored locally as fallback. Connect Google Drive in the top bar to store Instagram post media directly in your Google Drive.",
    });
  } catch (error: any) {
    console.error("Instagram media upload error:", error);
    return NextResponse.json(
      { error: error.message || "Failed to upload media file" },
      { status: 500 }
    );
  }
}
