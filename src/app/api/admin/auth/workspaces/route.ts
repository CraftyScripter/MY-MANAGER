import { NextResponse } from "next/server";
import { getCurrentUser, createTokenForUser, setAuthCookie } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { logActivity } from "@/lib/activity";

export async function GET() {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // 1. Fetch active memberships for this user
    const memberships = await prisma.workspaceMembership.findMany({
      where: { userId: user.id, isActive: true },
      select: {
        workspaceId: true,
        role: true,
        permissions: true,
      },
    });

    const workspaceOwnerIds = memberships.map((m) => m.workspaceId);
    const workspaceOwners = await prisma.user.findMany({
      where: { id: { in: workspaceOwnerIds } },
      select: { id: true, name: true, email: true },
    });

    // Check if the user is an admin in database
    const dbUser = await prisma.user.findUnique({
      where: { id: user.id },
      select: { role: true, name: true, email: true },
    });

    const workspaces: Array<{
      id: string;
      name: string;
      email: string;
      role: string;
      isCurrent: boolean;
    }> = [];

    if (dbUser?.role === "admin") {
      workspaces.push({
        id: "own",
        name: `${dbUser.name} (My Workspace)`,
        email: dbUser.email,
        role: "admin",
        isCurrent: !user.workspaceId,
      });
    }

    for (const m of memberships) {
      const owner = workspaceOwners.find((o) => o.id === m.workspaceId);
      workspaces.push({
        id: m.workspaceId,
        name: owner?.name ? `${owner.name}'s Workspace` : "Workspace",
        email: owner?.email || "",
        role: m.role,
        isCurrent: user.workspaceId === m.workspaceId,
      });
    }

    return NextResponse.json({
      workspaces,
      activeWorkspaceId: user.workspaceId || "own",
      success: true,
    });
  } catch (error: any) {
    return NextResponse.json(
      { error: error?.message || "Failed to fetch workspaces" },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const { workspaceId } = body;

    if (!workspaceId) {
      return NextResponse.json({ error: "workspaceId is required" }, { status: 400 });
    }

    // Switch to own admin workspace
    if (workspaceId === "own" || workspaceId === user.id) {
      const dbUser = await prisma.user.findUnique({
        where: { id: user.id },
        select: { role: true, permissions: true },
      });

      if (dbUser?.role !== "admin") {
        return NextResponse.json({ error: "Access denied" }, { status: 403 });
      }

      const token = createTokenForUser(user.id, "admin", ["*"]);
      await setAuthCookie(token);

      await logActivity({
        action: "switch_workspace",
        section: "auth",
        userEmail: user.email,
        userName: user.name,
        details: { workspaceId: "own" },
        req: request,
      });

      return NextResponse.json({
        success: true,
        workspaceId: "own",
        role: "admin",
      });
    }

    // Switch to member workspace
    const membership = await prisma.workspaceMembership.findUnique({
      where: {
        workspaceId_userId: {
          workspaceId,
          userId: user.id,
        },
      },
      select: {
        isActive: true,
        role: true,
        permissions: true,
      },
    });

    if (!membership || !membership.isActive) {
      return NextResponse.json(
        { error: "You do not have access to this workspace" },
        { status: 403 }
      );
    }

    const token = createTokenForUser(
      user.id,
      membership.role,
      membership.permissions,
      workspaceId
    );
    await setAuthCookie(token);

    await logActivity({
      action: "switch_workspace",
      section: "auth",
      userEmail: user.email,
      userName: user.name,
      details: { workspaceId, role: membership.role },
      req: request,
    });

    return NextResponse.json({
      success: true,
      workspaceId,
      role: membership.role,
      permissions: membership.permissions,
    });
  } catch (error: any) {
    return NextResponse.json(
      { error: error?.message || "Failed to switch workspace" },
      { status: 500 }
    );
  }
}
