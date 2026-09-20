import { NextResponse } from "next/server";
import {
  getCurrentUser,
  checkPermission,
  generateInvitationToken,
  getInvitationExpiry,
  getEffectiveWorkspaceAdminId,
} from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { sendInvitationEmail } from "@/lib/nodemailer";
import { ALL_PERMISSIONS } from "@/lib/permissions";
import { logActivity } from "@/lib/activity";

export async function GET() {
  try {
    const user = await getCurrentUser();
    if (!user || !checkPermission(user, "team")) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const workspaceId = getEffectiveWorkspaceAdminId(user);

    // Fetch workspace owner (Admin)
    const workspaceOwner = await prisma.user.findUnique({
      where: { id: workspaceId },
      select: {
        id: true,
        name: true,
        email: true,
        phone: true,
        role: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    // Workspace members via WorkspaceMembership
    const memberships = await prisma.workspaceMembership.findMany({
      where: { workspaceId },
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        role: true,
        permissions: true,
        isActive: true,
        invitationToken: true,
        createdAt: true,
        updatedAt: true,
        user: {
          select: {
            id: true,
            name: true,
            email: true,
            phone: true,
          },
        },
      },
    });

    // Build members list: Workspace Owner first (as admin/owner), then members
    const members = [];
    if (workspaceOwner) {
      members.push({
        id: workspaceOwner.id,
        membershipId: null,
        name: workspaceOwner.name,
        email: workspaceOwner.email,
        phone: workspaceOwner.phone,
        role: "admin",
        permissions: ["*"],
        isActive: true,
        invitationToken: null,
        createdAt: workspaceOwner.createdAt,
        updatedAt: workspaceOwner.updatedAt,
        isOwner: true,
      });
    }

    for (const m of memberships) {
      if (workspaceOwner && m.user.id === workspaceOwner.id) continue;
      members.push({
        id: m.user.id,
        membershipId: m.id,
        name: m.user.name,
        email: m.user.email,
        phone: m.user.phone,
        role: m.role || "member",
        permissions: m.permissions,
        isActive: m.isActive,
        invitationToken: m.invitationToken,
        createdAt: m.createdAt,
        updatedAt: m.updatedAt,
        isOwner: false,
      });
    }

    return NextResponse.json({
      members,
      canManageTeam: user.role === "admin",
      currentUserRole: user.role,
      currentUserId: user.id,
    });
  } catch (error) {
    console.error("Fetch team error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  try {
    const user = await getCurrentUser();
    if (!user || user.role !== "admin") {
      return NextResponse.json(
        { error: "Only workspace administrators can invite team members" },
        { status: 403 }
      );
    }

    const body = await request.json();
    const { name, email, phone, permissions } = body;

    if (!name || typeof name !== "string" || name.trim().length === 0) {
      return NextResponse.json(
        { error: "Name is required" },
        { status: 400 }
      );
    }

    if (!email || typeof email !== "string" || !email.includes("@")) {
      return NextResponse.json(
        { error: "Valid email is required" },
        { status: 400 }
      );
    }

    if (!Array.isArray(permissions)) {
      return NextResponse.json(
        { error: "Permissions must be an array" },
        { status: 400 }
      );
    }

    const invalidPerms = permissions.filter(
      (p: string) => !ALL_PERMISSIONS.includes(p as typeof ALL_PERMISSIONS[number])
    );
    if (invalidPerms.length > 0) {
      return NextResponse.json(
        { error: `Invalid permissions: ${invalidPerms.join(", ")}` },
        { status: 400 }
      );
    }

    const normalizedEmail = email.toLowerCase().trim();

    // Check if user already exists
    const existingUser = await prisma.user.findUnique({
      where: { email: normalizedEmail },
    });

    // Check if already a member of this workspace
    const workspaceOwnerId = getEffectiveWorkspaceAdminId(user);
    const existingMembership = existingUser
      ? await prisma.workspaceMembership.findUnique({
          where: {
            workspaceId_userId: {
              workspaceId: workspaceOwnerId,
              userId: existingUser.id,
            },
          },
        })
      : null;

    if (existingMembership) {
      return NextResponse.json(
        { error: "This user is already a team member of your workspace" },
        { status: 409 }
      );
    }

    // Case 1: User exists (e.g. they are an admin elsewhere) → Create membership
    if (existingUser) {
      const membership = await prisma.workspaceMembership.create({
        data: {
          workspaceId: workspaceOwnerId,
          userId: existingUser.id,
          role: "member",
          permissions,
          isActive: false, // Will be activated when they accept invitation
        },
        select: {
          id: true,
          role: true,
          permissions: true,
          isActive: true,
          createdAt: true,
        },
      });

      // Generate invitation token for this membership
      const invitationToken = generateInvitationToken();
      const invitationExpires = getInvitationExpiry();

      await prisma.workspaceMembership.update({
        where: { id: membership.id },
        data: { invitationToken, invitationExpires },
      });

      const appUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
      const invitationLink = `${appUrl}/accept-invitation?token=${invitationToken}`;

      // Fetch inviter info for email
      const inviter = await prisma.user.findUnique({
        where: { id: workspaceOwnerId },
        select: { name: true, email: true },
      });

      sendInvitationEmail(
        existingUser.email,
        existingUser.name,
        invitationLink,
        {
          inviterName: inviter?.name || "Admin",
          inviterEmail: inviter?.email,
          permissions,
          workspaceName: inviter?.name ? `${inviter.name}'s Workspace` : undefined,
        }
      ).catch((err) => console.error("Failed to send invitation email:", err));

      await logActivity({
        action: "invite_team_member",
        section: "team",
        user,
        details: { memberId: existingUser.id, name: existingUser.name, email: existingUser.email, permissions, type: "existing_user" },
        req: request,
      });

      return NextResponse.json({
        success: true,
        member: {
          id: existingUser.id,
          name: existingUser.name,
          email: existingUser.email,
          role: "member",
          permissions,
          isActive: false,
        },
        invitationLink,
        invitationToken,
      }, { status: 201 });
    }

    // Case 2: New user → Create user + membership
    const invitationToken = generateInvitationToken();
    const invitationExpires = getInvitationExpiry();

    const newUser = await prisma.user.create({
      data: {
        name: name.trim(),
        email: normalizedEmail,
        phone: phone?.trim() || null,
        role: "member",
        permissions: [],
        isActive: false,
      },
      select: {
        id: true,
        name: true,
        email: true,
        phone: true,
        role: true,
        isActive: true,
      },
    });

    const membership = await prisma.workspaceMembership.create({
      data: {
        workspaceId: workspaceOwnerId,
        userId: newUser.id,
        role: "member",
        permissions,
        isActive: false,
        invitationToken,
        invitationExpires,
      },
    });

    const appUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
    const invitationLink = `${appUrl}/accept-invitation?token=${invitationToken}`;

    // Fetch inviter info for email
    const inviter = await prisma.user.findUnique({
      where: { id: workspaceOwnerId },
      select: { name: true, email: true },
    });

    sendInvitationEmail(
      newUser.email,
      newUser.name,
      invitationLink,
      {
        inviterName: inviter?.name || "Admin",
        inviterEmail: inviter?.email,
        permissions,
        workspaceName: inviter?.name ? `${inviter.name}'s Workspace` : undefined,
      }
    ).catch((err) => console.error("Failed to send invitation email:", err));

    await logActivity({
      action: "invite_team_member",
      section: "team",
      user,
      details: { memberId: newUser.id, name: newUser.name, email: newUser.email, permissions, type: "new_user" },
      req: request,
    });

    return NextResponse.json({
      success: true,
      member: {
        ...newUser,
        permissions,
      },
      invitationLink,
      invitationToken,
    }, { status: 201 });
  } catch (error) {

    console.error("Create team member error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
