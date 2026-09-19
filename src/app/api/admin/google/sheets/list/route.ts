import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { getValidGoogleAccount } from "@/lib/google";
import { listDriveSpreadsheets } from "@/lib/google-drive";

export async function GET() {
  try {
    const user = await getCurrentUser();
    const userId = user?.id || "admin";

    const account = await getValidGoogleAccount(userId);
    if (!account) {
      return NextResponse.json(
        { error: "Google account not connected" },
        { status: 401 }
      );
    }

    const spreadsheets = await listDriveSpreadsheets(account.accessToken);
    return NextResponse.json({ spreadsheets, success: true });
  } catch (error: any) {
    return NextResponse.json(
      { error: error?.message || "Failed to list spreadsheets" },
      { status: 500 }
    );
  }
}
