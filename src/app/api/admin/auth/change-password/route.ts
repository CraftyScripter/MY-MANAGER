import { NextResponse } from "next/server";
import { getCurrentUser, verifyPassword, hashPassword } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { logActivity } from "@/lib/activity";

export async function POST(request: Request) {
  try {
    const user = await getCurrentUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const { currentPassword, newPassword } = body;

    if (!currentPassword || !newPassword) {
      return NextResponse.json(
        { error: "Current password and new password are required" },
        { status: 400 }
      );
    }

    if (newPassword.length < 6) {
      return NextResponse.json(
        { error: "New password must be at least 6 characters" },
        { status: 400 }
      );
    }

    if (user.id === "admin") {
      const adminPass = process.env.ADMIN_PASS;
      if (!adminPass || currentPassword !== adminPass) {
        return NextResponse.json(
          { error: "Current password is incorrect" },
          { status: 401 }
        );
      }

      const hashed = await hashPassword(newPassword);
      await prisma.user.upsert({
        where: { id: "admin" },
        create: {
          id: "admin",
          name: "Admin",
          email: process.env.ADMIN_USER || "admin",
          passwordHash: hashed,
          role: "admin",
        },
        update: {
          passwordHash: hashed,
        },
      });

      await logActivity({
        action: "change_password",
        section: "auth",
        user,
        details: { target: "admin" },
        req: request,
      });

      return NextResponse.json({ success: true });
    }

    const dbUser = await prisma.user.findUnique({
      where: { id: user.id },
      select: {
        id: true,
        passwordHash: true,
      },
    });

    if (!dbUser || !dbUser.passwordHash) {
      return NextResponse.json(
        { error: "User not found or no password set" },
        { status: 404 }
      );
    }

    const valid = await verifyPassword(currentPassword, dbUser.passwordHash);
    if (!valid) {
      return NextResponse.json(
        { error: "Current password is incorrect" },
        { status: 401 }
      );
    }

    const hashed = await hashPassword(newPassword);
    await prisma.user.update({
      where: { id: user.id },
      data: { passwordHash: hashed },
    });

    await logActivity({
      action: "change_password",
      section: "auth",
      user,
      details: { userId: user.id },
      req: request,
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Password change error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

