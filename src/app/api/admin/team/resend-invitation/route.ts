import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import {
  getCurrentUser,
  checkPermission,
  generateInvitationToken,
  getInvitationExpiry,
} from "@/lib/auth";
import { sendInvitationEmail } from "@/lib/nodemailer";

export async function POST(request: Request) {
  try {
    const user = await getCurrentUser();
    if (!user || !checkPermission(user, "team")) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const body = await request.json();
    const { userId } = body;

    if (!userId) {
      return NextResponse.json(
        { error: "User ID is required" },
        { status: 400 }
      );
    }

    const targetUser = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        name: true,
        email: true,
        isActive: true,
      },
    });

    if (!targetUser) {
      return NextResponse.json(
        { error: "Team member not found" },
        { status: 404 }
      );
    }

    if (targetUser.isActive) {
      return NextResponse.json(
        { error: "This user has already activated their account" },
        { status: 400 }
      );
    }

    const invitationToken = generateInvitationToken();
    const invitationExpires = getInvitationExpiry();

    await prisma.user.update({
      where: { id: userId },
      data: {
        invitationToken,
        invitationExpires,
      },
    });

    const appUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
    const invitationLink = `${appUrl}/accept-invitation?token=${invitationToken}`;

    await sendInvitationEmail(
      targetUser.email,
      targetUser.name,
      invitationLink
    );

    return NextResponse.json({
      success: true,
      message: "Invitation resent successfully",
      invitationLink,
      invitationToken,
    });
  } catch (error) {
    console.error("Resend invitation error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
