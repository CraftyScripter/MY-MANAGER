import { NextResponse } from "next/server";
import { getCurrentUser, createTokenForUser, setAuthCookie } from "@/lib/auth";
import { getWorkspaceAdminGoogleAccount } from "@/lib/google";

export async function GET() {
  try {
    const user = await getCurrentUser();

    if (!user) {
      return NextResponse.json({ authenticated: false }, { status: 401 });
    }

    // Sliding session renewal — always use real user data
    const freshToken = createTokenForUser(user.id, user.role, user.permissions);
    await setAuthCookie(freshToken);

    // Fetch linked Google profile picture and display name if available
    let image: string | null = null;
    let googleName: string | null = null;

    try {
      const googleAccount = await getWorkspaceAdminGoogleAccount(user.id);
      image = googleAccount?.picture || null;
      googleName = googleAccount?.name || null;
    } catch {
      // Non-blocking – image stays null
    }

    const displayName = googleName || user.name;

    return NextResponse.json({
      authenticated: true,
      user: {
        id: user.id,
        name: displayName,
        email: user.email,
        phone: user.phone || null,
        role: user.role,
        permissions: user.permissions,
        image,
      },
    });
  } catch (error) {
    console.error("Auth check error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
