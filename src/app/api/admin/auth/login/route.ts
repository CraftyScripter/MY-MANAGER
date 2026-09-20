import { NextResponse } from "next/server";
import {
  setAuthCookie,
  verifyPassword,
  createTokenForUser,
} from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { logActivity } from "@/lib/activity";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { username, password } = body;

    if (!username || !password) {
      return NextResponse.json(
        { error: "Username and password are required" },
        { status: 400 }
      );
    }

    // Database-only login — no env var bypass
    const user = await prisma.user.findUnique({
      where: { email: username },
      select: {
        id: true,
        name: true,
        email: true,
        passwordHash: true,
        isActive: true,
        role: true,
        permissions: true,
      },
    });

    if (user && user.passwordHash && user.isActive) {
      const valid = await verifyPassword(password, user.passwordHash);
      if (valid) {
        const token = createTokenForUser(
          user.id,
          user.role,
          user.permissions
        );
        await setAuthCookie(token);

        await logActivity({
          action: "login",
          section: "auth",
          userEmail: user.email,
          userName: user.name,
          details: { role: user.role },
          req: request,
        });

        return NextResponse.json({ success: true, role: user.role, permissions: user.permissions });
      }
    }

    return NextResponse.json(
      { error: "Invalid credentials" },
      { status: 401 }
    );
  } catch (error) {
    console.error("Login error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

