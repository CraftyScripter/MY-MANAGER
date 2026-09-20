import { NextResponse } from "next/server";
import { getCurrentUser, createTokenForUser, setAuthCookie, getAuthToken, verifySignedToken } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET() {
  try {
    const user = await getCurrentUser();

    if (!user) {
      return NextResponse.json({ authenticated: false }, { status: 401 });
    }

    // Sliding session renewal — preserve workspaceId from existing token
    const existingToken = await getAuthToken();
    const existingPayload = existingToken ? verifySignedToken(existingToken) : null;
    const freshToken = createTokenForUser(
      user.id,
      user.role,
      user.permissions,
      existingPayload?.workspaceId
    );
    await setAuthCookie(freshToken);

    // Fetch logged-in user's own Google profile picture and name
    let image: string | null = null;
    let googleName: string | null = null;

    try {
      const userGoogleAccount = await prisma.googleAccount.findFirst({
        where: {
          OR: [
            { userId: user.id },
            { email: user.email.toLowerCase() },
          ],
        },
        orderBy: { updatedAt: "desc" },
      });
      image = userGoogleAccount?.picture || null;
      googleName = userGoogleAccount?.name || null;
    } catch {
      // Non-blocking – image stays null
    }

    const displayName = user.name || googleName || user.email.split("@")[0];

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
        workspaceId: user.workspaceId || null,
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
