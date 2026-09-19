import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { createEncryptedDriveBackup } from "@/lib/google-drive";

export async function POST() {
  try {
    const user = await getCurrentUser();
    const userId = user?.id || "admin";

    const result = await createEncryptedDriveBackup(userId);

    return NextResponse.json({
      success: true,
      message: "Encrypted backup successfully saved to Google Drive (MyManager_AppData)",
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
