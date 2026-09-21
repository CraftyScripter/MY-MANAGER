import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser, getEffectiveWorkspaceAdminId } from "@/lib/auth";
import { uploadToAdminDrive } from "@/lib/googleDriveService";
import { getWorkspaceAdminGoogleAccount, getValidGoogleAccount } from "@/lib/google";
import fs from "fs";
import path from "path";

// Instagram limits
const INSTAGRAM_MAX_WIDTH = 1080;
const INSTAGRAM_MAX_HEIGHT = 1350;
const INSTAGRAM_JPEG_QUALITY = 85;

async function resizeImageForInstagram(inputBuffer: Buffer): Promise<Buffer> {
  // Dynamic import to avoid top-level native module crash
  const sharp = (await import("sharp")).default;

  const metadata = await sharp(inputBuffer).metadata();
  const origW = metadata.width || 0;
  const origH = metadata.height || 0;

  const needsResize =
    origW > INSTAGRAM_MAX_WIDTH ||
    origH > INSTAGRAM_MAX_HEIGHT ||
    metadata.format === "png" || // Convert PNG → JPEG for smaller size
    (inputBuffer.length > 4 * 1024 * 1024); // > 4MB

  if (!needsResize) return inputBuffer;

  console.log(
    `[Instagram Upload] Resizing image: ${origW}x${origH}, ${(inputBuffer.length / 1024 / 1024).toFixed(1)}MB → max ${INSTAGRAM_MAX_WIDTH}x${INSTAGRAM_MAX_HEIGHT}`
  );

  let pipeline = sharp(inputBuffer).rotate(); // Auto-rotate based on EXIF

  // Resize to fit within Instagram limits, preserving aspect ratio
  pipeline = pipeline.resize({
    width: INSTAGRAM_MAX_WIDTH,
    height: INSTAGRAM_MAX_HEIGHT,
    fit: "inside",
    withoutEnlargement: true, // Don't upscale small images
  });

  // Convert to JPEG with good quality
  pipeline = pipeline.jpeg({
    quality: INSTAGRAM_JPEG_QUALITY,
    mozjpeg: true, // Better compression
  });

  const resized = await pipeline.toBuffer();

  const newMetadata = await sharp(resized).metadata();
  console.log(
    `[Instagram Upload] Resized to: ${newMetadata.width}x${newMetadata.height}, ${(resized.length / 1024 / 1024).toFixed(1)}MB`
  );

  return resized;
}

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

    let buffer: Buffer = Buffer.from(await file.arrayBuffer());
    const isVideo = file.type.startsWith("video/") || Boolean(file.name.match(/\.(mp4|mov|webm)$/i));
    const resourceType = isVideo ? "video" : "image";
    const mimeType = file.type || (isVideo ? "video/mp4" : "image/jpeg");

    // Resize images to fit Instagram limits (skip videos — Instagram handles those)
    if (!isVideo && file.type.startsWith("image/")) {
      try {
        buffer = await resizeImageForInstagram(buffer);
      } catch (resizeErr: any) {
        console.warn("[Instagram Upload] Resize failed, using original image:", resizeErr.message);
        // Continue with original buffer if resize fails
      }
    }

    const timestamp = Date.now();
    const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
    const uniqueFilename = `${timestamp}_${safeName}`;

    // Resolve public origin for URLs:
    let publicOrigin = "";

    if (process.env.NEXT_PUBLIC_APP_URL && !process.env.NEXT_PUBLIC_APP_URL.includes("localhost")) {
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
          // For photos, Google's direct CDN URL (lh3.googleusercontent.com/d/:fileId) is globally accessible,
          // extremely fast, and works seamlessly with Meta Instagram Graph API without requiring tunnels.
          const driveDirectUrl = !isVideo ? `https://lh3.googleusercontent.com/d/${driveFile.fileId}` : "";
          const streamUrl = `${publicOrigin}/api/public/media/${driveFile.fileId}?adminId=${workspaceId}`;
          const effectiveUrl = driveDirectUrl || streamUrl;

          return NextResponse.json({
            url: effectiveUrl,
            directUrl: driveDirectUrl || null,
            streamUrl,
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
