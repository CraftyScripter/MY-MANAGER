import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { getWorkspaceAdminGoogleAccount } from "@/lib/google";
import { listDriveSpreadsheets } from "@/lib/google-drive";

export async function GET() {
  try {
    const user = await getCurrentUser();
    const userId = user?.id || "admin";

    const account = await getWorkspaceAdminGoogleAccount(userId);
    if (!account) {
      return NextResponse.json(
        { error: "Google account not connected" },
        { status: 401 }
      );
    }

    const scope = account.scope || "";
    const hasDriveScope =
      scope.includes("drive.readonly") ||
      scope.includes("https://www.googleapis.com/auth/drive ") ||
      scope.endsWith("https://www.googleapis.com/auth/drive");

    if (!hasDriveScope) {
      return NextResponse.json({
        spreadsheets: [],
        hasDriveScope: false,
        account: {
          id: account.id,
          name: account.name,
          email: account.email,
          picture: account.picture,
        },
        success: true,
      });
    }

    const spreadsheets = await listDriveSpreadsheets(account.accessToken);
    return NextResponse.json({
      spreadsheets,
      hasDriveScope: true,
      account: {
        id: account.id,
        name: account.name,
        email: account.email,
        picture: account.picture,
      },
      success: true,
    });
  } catch (error: any) {
    return NextResponse.json(
      { error: error?.message || "Failed to list spreadsheets" },
      { status: 500 }
    );
  }
}
