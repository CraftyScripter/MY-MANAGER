import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import {
  getCurrentUser,
  checkPermission,
  generateInvitationToken,
  getInvitationExpiry,
  getEffectiveWorkspaceAdminId,
} from "@/lib/auth";
import { sendInvitationEmail } from "@/lib/nodemailer";

export async function POST(request: Request) {
  try {
    const user = await getCurrentUser();
    if (!user || user.role !== "admin") {
      return NextResponse.json(
        { error: "Only administrators can resend invitations" },
        { status: 403 }
      );
    }

    const body = await request.json();
    const { userId } = body;

    if (!userId) {
      return NextResponse.json(
        { error: "User ID is required" },
        { status: 400 }
      );
    }

    const workspaceId = getEffectiveWorkspaceAdminId(user);

    // Find the workspace membership for this user
    const membership = await prisma.workspaceMembership.findUnique({
      where: {
        workspaceId_userId: {
          workspaceId,
          userId,
        },
      },
      select: {
        id: true,
        isActive: true,
        permissions: true,
        user: {
          select: { id: true, name: true, email: true },
        },
      },
    });

    if (!membership) {
      return NextResponse.json(
        { error: "Team member not found" },
        { status: 404 }
      );
    }

    if (membership.isActive) {
      return NextResponse.json(
        { error: "This user has already activated their account" },
        { status: 400 }
      );
    }

    const invitationToken = generateInvitationToken();
    const invitationExpires = getInvitationExpiry();

    await prisma.workspaceMembership.update({
      where: { id: membership.id },
      data: {
        invitationToken,
        invitationExpires,
      },
    });

    const appUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
    const invitationLink = `${appUrl}/accept-invitation?token=${invitationToken}`;

    // Fetch inviter info for email
    const inviter = await prisma.user.findUnique({
      where: { id: workspaceId },
      select: { name: true, email: true },
    });

    await sendInvitationEmail(
      membership.user.email,
      membership.user.name,
      invitationLink,
      {
        inviterName: inviter?.name || "Admin",
        inviterEmail: inviter?.email,
        permissions: membership.permissions,
        workspaceName: inviter?.name ? `${inviter.name}'s Workspace` : undefined,
      }
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
