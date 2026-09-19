import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser, checkPermission } from "@/lib/auth";
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
    const member = await prisma.user.findUnique({
      where: { id },
      select: {
        id: true,
        name: true,
        email: true,
        phone: true,
        role: true,
        permissions: true,
        isActive: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    if (!member) {
      return NextResponse.json(
        { error: "Team member not found" },
        { status: 404 }
      );
    }

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
    if (!user || !checkPermission(user, "team", "write")) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { id } = await params;
    const body = await request.json();
    const { name, email, phone, permissions } = body;

    const existing = await prisma.user.findUnique({
      where: { id },
      select: { id: true, email: true },
    });

    if (!existing) {
      return NextResponse.json(
        { error: "Team member not found" },
        { status: 404 }
      );
    }

    const updateData: Record<string, unknown> = {};

    if (name !== undefined) {
      if (typeof name !== "string" || name.trim().length === 0) {
        return NextResponse.json(
          { error: "Name cannot be empty" },
          { status: 400 }
        );
      }
      updateData.name = name.trim();
    }

    if (email !== undefined) {
      if (typeof email !== "string" || !email.includes("@")) {
        return NextResponse.json(
          { error: "Valid email is required" },
          { status: 400 }
        );
      }
      const newEmail = email.toLowerCase().trim();
      if (newEmail !== existing.email) {
        const emailTaken = await prisma.user.findUnique({
          where: { email: newEmail },
        });
        if (emailTaken) {
          return NextResponse.json(
            { error: "A user with this email already exists" },
            { status: 409 }
          );
        }
      }
      updateData.email = newEmail;
    }

    if (phone !== undefined) {
      updateData.phone = phone?.trim() || null;
    }

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
      updateData.permissions = permissions;
    }

    const updated = await prisma.user.update({
      where: { id },
      data: updateData,
      select: {
        id: true,
        name: true,
        email: true,
        phone: true,
        role: true,
        permissions: true,
        isActive: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    return NextResponse.json({ success: true, member: updated });
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
    if (!user || !checkPermission(user, "team", "write")) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { id } = await params;

    const existing = await prisma.user.findUnique({
      where: { id },
      select: { id: true, role: true },
    });

    if (!existing) {
      return NextResponse.json(
        { error: "Team member not found" },
        { status: 404 }
      );
    }

    if (existing.role === "admin") {
      return NextResponse.json(
        { error: "Cannot remove admin users" },
        { status: 403 }
      );
    }

    await prisma.user.delete({ where: { id } });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Delete team member error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
