import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { createEncryptedDriveBackup, listBackupFiles } from "@/lib/google-drive";

// POST - Trigger a full backup
export async function POST() {
  try {
    const user = await getCurrentUser();
    const userId = user?.id || "admin";

    const result = await createEncryptedDriveBackup(userId);

    return NextResponse.json({
      success: true,
      message: "Full encrypted backup saved to Google Drive (MyManager_AppData). Includes: payments, enquiries, credentials, form projects, instagram, activity logs, appointments, users, leads, env vars.",
      data: result,
    });
  } catch (error: any) {
    console.error("Google Drive backup trigger error:", error);
    return NextResponse.json(
      { error: error?.message || "Failed to trigger Google Drive backup" },
      { status: 500 }
    );
  }
}

// GET - List available backups
export async function GET() {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const files = await listBackupFiles();
    return NextResponse.json({ backups: files });
  } catch (error: any) {
    console.error("List backups error:", error);
    return NextResponse.json(
      { error: error?.message || "Failed to list backups" },
      { status: 500 }
    );
  }
}
