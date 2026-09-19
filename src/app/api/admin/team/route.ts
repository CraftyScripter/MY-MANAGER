import { NextResponse } from "next/server";
import {
  getCurrentUser,
  checkPermission,
  generateInvitationToken,
  getInvitationExpiry,
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

    const members = await prisma.user.findMany({
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        name: true,
        email: true,
        phone: true,
        role: true,
        permissions: true,
        isActive: true,
        invitationToken: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    return NextResponse.json({ members });
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
    if (!user || !checkPermission(user, "team", "write")) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
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

    const existing = await prisma.user.findUnique({
      where: { email: email.toLowerCase().trim() },
    });

    if (existing) {
      return NextResponse.json(
        { error: "A user with this email already exists" },
        { status: 409 }
      );
    }

    const invitationToken = generateInvitationToken();
    const invitationExpires = getInvitationExpiry();

    const newUser = await prisma.user.create({
      data: {
        name: name.trim(),
        email: email.toLowerCase().trim(),
        phone: phone?.trim() || null,
        permissions,
        role: "member",
        isActive: false,
        invitationToken,
        invitationExpires,
      },
      select: {
        id: true,
        name: true,
        email: true,
        phone: true,
        role: true,
        permissions: true,
        isActive: true,
        invitationToken: true,
        createdAt: true,
      },
    });

    const appUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
    const invitationLink = `${appUrl}/accept-invitation?token=${invitationToken}`;

    sendInvitationEmail(
      newUser.email,
      newUser.name,
      invitationLink
    ).catch((err) => console.error("Failed to send invitation email:", err));

    await logActivity({
      action: "invite_team_member",
      section: "team",
      user,
      details: { memberId: newUser.id, name: newUser.name, email: newUser.email, permissions },
      req: request,
    });

    return NextResponse.json({
      success: true,
      member: newUser,
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
