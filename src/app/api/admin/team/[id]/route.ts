import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser, checkPermission, getEffectiveWorkspaceAdminId } from "@/lib/auth";
import { ALL_PERMISSIONS } from "@/lib/permissions";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getCurrentUser();
    if (!user || !checkPermission(user, "team")) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { id } = await params;
    const workspaceId = getEffectiveWorkspaceAdminId(user);

    // If requesting the workspace owner
    if (id === workspaceId) {
      const owner = await prisma.user.findUnique({
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

      if (!owner) {
        return NextResponse.json(
          { error: "Team member not found" },
          { status: 404 }
        );
      }

      return NextResponse.json({
        member: {
          id: owner.id,
          membershipId: null,
          name: owner.name,
          email: owner.email,
          phone: owner.phone,
          role: "admin",
          permissions: ["*"],
          isActive: true,
          createdAt: owner.createdAt,
          updatedAt: owner.updatedAt,
          isOwner: true,
        },
      });
    }

    // Find membership for this user in this workspace
    const membership = await prisma.workspaceMembership.findUnique({
      where: {
        workspaceId_userId: {
          workspaceId,
          userId: id,
        },
      },
      select: {
        id: true,
        role: true,
        permissions: true,
        isActive: true,
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

    if (!membership) {
      return NextResponse.json(
        { error: "Team member not found" },
        { status: 404 }
      );
    }

    const member = {
      id: membership.user.id,
      membershipId: membership.id,
      name: membership.user.name,
      email: membership.user.email,
      phone: membership.user.phone,
      role: membership.role,
      permissions: membership.permissions,
      isActive: membership.isActive,
      createdAt: membership.createdAt,
      updatedAt: membership.updatedAt,
      isOwner: false,
    };

    return NextResponse.json({ member });
  } catch (error) {
    console.error("Fetch team member error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getCurrentUser();
    if (!user || user.role !== "admin") {
      return NextResponse.json(
        { error: "Only administrators can update team members" },
        { status: 403 }
      );
    }

    const { id } = await params;
    const workspaceId = getEffectiveWorkspaceAdminId(user);

    if (id === workspaceId) {
      return NextResponse.json(
        { error: "Cannot modify workspace owner permissions" },
        { status: 400 }
      );
    }

    const body = await request.json();
    const { name, email, phone, permissions } = body;

    // Find membership for this user in this workspace
    const membership = await prisma.workspaceMembership.findUnique({
      where: {
        workspaceId_userId: {
          workspaceId,
          userId: id,
        },
      },
      select: { id: true, user: { select: { email: true } } },
    });

    if (!membership) {
      return NextResponse.json(
        { error: "Team member not found" },
        { status: 404 }
      );
    }

    // Update user details (name, email, phone)
    const userUpdateData: Record<string, unknown> = {};
    if (name !== undefined) {
      if (typeof name !== "string" || name.trim().length === 0) {
        return NextResponse.json(
          { error: "Name cannot be empty" },
          { status: 400 }
        );
      }
      userUpdateData.name = name.trim();
    }
    if (email !== undefined) {
      if (typeof email !== "string" || !email.includes("@")) {
        return NextResponse.json(
          { error: "Valid email is required" },
          { status: 400 }
        );
      }
      userUpdateData.email = email.toLowerCase().trim();
    }
    if (phone !== undefined) {
      userUpdateData.phone = phone?.trim() || null;
    }

    if (Object.keys(userUpdateData).length > 0) {
      await prisma.user.update({
        where: { id },
        data: userUpdateData,
      });
    }

    // Update membership details (permissions)
    const membershipUpdateData: Record<string, unknown> = {};
    if (permissions !== undefined) {
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
      membershipUpdateData.permissions = permissions;
    }

    if (Object.keys(membershipUpdateData).length > 0) {
      await prisma.workspaceMembership.update({
        where: { id: membership.id },
        data: membershipUpdateData,
      });
    }

    // Fetch updated data
    const updatedMembership = await prisma.workspaceMembership.findUnique({
      where: { id: membership.id },
      select: {
        role: true,
        permissions: true,
        isActive: true,
        createdAt: true,
        updatedAt: true,
        user: {
          select: { id: true, name: true, email: true, phone: true },
        },
      },
    });

    const member = {
      id: updatedMembership!.user.id,
      membershipId: membership.id,
      name: updatedMembership!.user.name,
      email: updatedMembership!.user.email,
      phone: updatedMembership!.user.phone,
      role: updatedMembership!.role,
      permissions: updatedMembership!.permissions,
      isActive: updatedMembership!.isActive,
      createdAt: updatedMembership!.createdAt,
      updatedAt: updatedMembership!.updatedAt,
      isOwner: false,
    };

    return NextResponse.json({ success: true, member });
  } catch (error) {
    console.error("Update team member error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getCurrentUser();
    if (!user || user.role !== "admin") {
      return NextResponse.json(
        { error: "Only administrators can remove team members" },
        { status: 403 }
      );
    }

    const { id } = await params;
    const workspaceId = getEffectiveWorkspaceAdminId(user);

    // Prevent deleting the workspace administrator/owner
    if (id === workspaceId) {
      return NextResponse.json(
        { error: "Cannot delete the workspace administrator" },
        { status: 400 }
      );
    }

    // Find membership
    const membership = await prisma.workspaceMembership.findUnique({
      where: {
        workspaceId_userId: {
          workspaceId,
          userId: id,
        },
      },
      select: { id: true, role: true },
    });

    if (!membership) {
      return NextResponse.json(
        { error: "Team member not found" },
        { status: 404 }
      );
    }

    if (membership.role === "admin") {
      return NextResponse.json(
        { error: "Cannot delete an administrator" },
        { status: 400 }
      );
    }

    // Delete membership (not the user — they might be admin elsewhere)
    await prisma.workspaceMembership.delete({
      where: { id: membership.id },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Delete team member error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
