import { NextResponse } from "next/server";
import { getCurrentUser, createTokenForUser, setAuthCookie } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET() {
  try {
    const user = await getCurrentUser();

    if (!user) {
      return NextResponse.json({ authenticated: false }, { status: 401 });
    }

    // Refresh the auth cookie with latest permissions from database
    if (user.role !== "admin") {
      const freshToken = createTokenForUser(user.id, user.role, user.permissions);
      await setAuthCookie(freshToken);
    }

    // Fetch linked Google profile picture if available
    let image: string | null = null;
    try {
      const googleAccount = await prisma.googleAccount.findFirst({
        where: { userId: user.id === "admin" ? "admin" : user.id },
        select: { picture: true },
      });
      image = googleAccount?.picture || null;
    } catch {
      // Non-blocking – image stays null
    }

    return NextResponse.json({
      authenticated: true,
      user: {
        id: user.id,
        name: user.name,
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
