import { NextResponse } from "next/server";
import { getCurrentUser, getAuthToken, verifySignedToken } from "@/lib/auth";
import { getWorkspaceAdminGoogleAccount } from "@/lib/google";
import { listDriveSpreadsheets } from "@/lib/google-drive";

export async function GET() {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Determine workspace admin ID:
    // Team members (have workspaceId in token) → use workspace owner's ID
    // Admins (no workspaceId) → use their own ID
    const workspaceAdminId = user.workspaceId || user.id;
    const isWorkspaceAdmin = user.role === "admin" && !user.workspaceId;

    const account = await getWorkspaceAdminGoogleAccount(workspaceAdminId);
    if (!account) {
      return NextResponse.json(
        {
          error: "Google account not connected",
          account: null,
          isAdmin: isWorkspaceAdmin,
        },
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
        isAdmin: isWorkspaceAdmin,
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
      isAdmin: isWorkspaceAdmin,
      success: true,
    });
  } catch (error: any) {
    return NextResponse.json(
      { error: error?.message || "Failed to list spreadsheets" },
      { status: 500 }
    );
  }
}
