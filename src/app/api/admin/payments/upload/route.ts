import { NextResponse } from "next/server";
import { uploadReceipt } from "@/lib/cloudinary";
import { uploadToAdminDrive } from "@/lib/googleDriveService";
import { getCurrentUser, checkPermission } from "@/lib/auth";

const MAX_FILE_SIZE = 15 * 1024 * 1024;
const ALLOWED_TYPES = [
  "image/jpeg",
  "image/png",
  "image/gif",
  "image/webp",
  "application/pdf",
];

export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user || !checkPermission(user, "finance", "write")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  try {
    const formData = await request.formData();
    const file = formData.get("receipt") as File | null;

    if (!file) {
      return NextResponse.json({ error: "No file provided" }, { status: 400 });
    }

    if (!ALLOWED_TYPES.includes(file.type)) {
      return NextResponse.json(
        { error: "Invalid file type. Allowed: JPEG, PNG, GIF, WebP, PDF" },
        { status: 400 }
      );
    }

    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json(
        { error: "File too large. Maximum size: 15MB" },
        { status: 400 }
      );
    }

    const buffer = Buffer.from(await file.arrayBuffer());

    // 1. Try uploading directly to Workspace Admin's Google Drive
    try {
      const driveFile = await uploadToAdminDrive({
        fileName: file.name,
        mimeType: file.type,
        buffer,
        folderCategory: "finance",
        makePublicReadable: true,
      });

      return NextResponse.json({
        success: true,
        url: driveFile.webViewLink || driveFile.webContentLink || "",
        publicId: driveFile.fileId,
        source: "google_drive",
        driveFileId: driveFile.fileId,
      });
    } catch (driveErr) {
      console.warn("Google Drive upload skipped/fallback to Cloudinary:", driveErr);
    }

    // 2. Fallback to Cloudinary if Google Drive not configured yet
    const result = await uploadReceipt(buffer, file.name);

    return NextResponse.json({
      success: true,
      url: result.url,
      publicId: result.publicId,
      source: "cloudinary",
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to upload receipt";
    console.error("Upload receipt error:", error);
    return NextResponse.json(
      { error: message },
      { status: 500 }
    );
  }
}

