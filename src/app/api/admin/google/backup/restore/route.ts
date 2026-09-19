import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { listBackupFiles, restoreFromBackup } from "@/lib/google-drive";

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

// POST - Restore from a backup
export async function POST(request: Request) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const { backupFileId, options } = body;

    if (!backupFileId) {
      return NextResponse.json(
        { error: "backupFileId is required" },
        { status: 400 }
      );
    }

    const result = await restoreFromBackup(backupFileId, "admin", {
      restorePayments: true,
      restoreEnquiries: true,
      restoreCredentials: true,
      restoreFormProjects: true,
      restoreInstagram: true,
      restoreActivityLogs: true,
      restoreAppointments: true,
      ...options,
    });

    return NextResponse.json(result);
  } catch (error: any) {
    console.error("Restore error:", error);
    return NextResponse.json(
      { error: error?.message || "Failed to restore from backup" },
      { status: 500 }
    );
  }
}
