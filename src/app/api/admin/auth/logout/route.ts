import { NextResponse } from "next/server";
import { getCurrentUser, removeAuthCookie } from "@/lib/auth";
import { logActivity } from "@/lib/activity";

export async function POST(request: Request) {
  try {
    const user = await getCurrentUser();
    if (user) {
      await logActivity({
        action: "logout",
        section: "auth",
        user,
        details: { role: user.role },
        req: request,
      });
    }

    await removeAuthCookie();
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Logout error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

