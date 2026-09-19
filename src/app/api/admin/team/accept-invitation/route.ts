import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { hashPassword } from "@/lib/auth";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const token = searchParams.get("token");

    if (!token) {
      return NextResponse.json(
        { error: "Token is required" },
        { status: 400 }
      );
    }

    const user = await prisma.user.findFirst({
      where: { invitationToken: token },
      select: {
        id: true,
        name: true,
        email: true,
        isActive: true,
        invitationExpires: true,
      },
    });

    if (!user) {
      return NextResponse.json(
        { error: "Invalid invitation link" },
        { status: 404 }
      );
    }

    if (user.isActive) {
      return NextResponse.json(
        { error: "This invitation has already been used" },
        { status: 400 }
      );
    }

    if (user.invitationExpires && new Date() > user.invitationExpires) {
      return NextResponse.json(
        { error: "This invitation has expired" },
        { status: 400 }
      );
    }

    return NextResponse.json({
      valid: true,
      user: { name: user.name, email: user.email },
    });
  } catch (error: any) {
    console.error("Validate invitation error:", error);
    const isTimeout =
      error?.code === "P2024" ||
      error?.name === "PrismaClientInitializationError" ||
      error?.message?.toLowerCase().includes("timed out") ||
      error?.message?.toLowerCase().includes("timeout");
    return NextResponse.json(
      {
        error: isTimeout
          ? "Database connection timed out. Please check your network and try again."
          : "Failed to verify invitation. Please try again.",
      },
      { status: isTimeout ? 504 : 500 }
    );
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { token, password, confirmPassword } = body;

    if (!token || !password) {
      return NextResponse.json(
        { error: "Token and password are required" },
        { status: 400 }
      );
    }

    if (password !== confirmPassword) {
      return NextResponse.json(
        { error: "Passwords do not match" },
        { status: 400 }
      );
    }

    if (password.length < 8) {
      return NextResponse.json(
        { error: "Password must be at least 8 characters" },
        { status: 400 }
      );
    }

    const user = await prisma.user.findFirst({
      where: { invitationToken: token },
      select: {
        id: true,
        isActive: true,
        invitationExpires: true,
      },
    });

    if (!user) {
      return NextResponse.json(
        { error: "Invalid invitation link" },
        { status: 404 }
      );
    }

    if (user.isActive) {
      return NextResponse.json(
        { error: "This invitation has already been used" },
        { status: 400 }
      );
    }

    if (user.invitationExpires && new Date() > user.invitationExpires) {
      return NextResponse.json(
        { error: "This invitation has expired" },
        { status: 400 }
      );
    }

    const passwordHash = await hashPassword(password);

    await prisma.user.update({
      where: { id: user.id },
      data: {
        passwordHash,
        isActive: true,
        invitationToken: null,
        invitationExpires: null,
      },
    });

    return NextResponse.json({
      success: true,
      message: "Account activated successfully. You can now log in.",
    });
  } catch (error: any) {
    console.error("Accept invitation error:", error);
    const isTimeout =
      error?.code === "P2024" ||
      error?.name === "PrismaClientInitializationError" ||
      error?.message?.toLowerCase().includes("timed out") ||
      error?.message?.toLowerCase().includes("timeout");
    return NextResponse.json(
      {
        error: isTimeout
          ? "Database connection timed out. Please try again shortly."
          : "Internal server error",
      },
      { status: isTimeout ? 504 : 500 }
    );
  }
}
