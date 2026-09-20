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
    const { username, password, workspaceId } = body;

    if (!username || !password) {
      return NextResponse.json(
        { error: "Username and password are required" },
        { status: 400 }
      );
    }

    // Find user by email
    const user = await prisma.user.findUnique({
      where: { email: username.toLowerCase().trim() },
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

    if (!user || !user.passwordHash || !user.isActive) {
      return NextResponse.json(
        { error: "Invalid credentials" },
        { status: 401 }
      );
    }

    const valid = await verifyPassword(password, user.passwordHash);
    if (!valid) {
      return NextResponse.json(
        { error: "Invalid credentials" },
        { status: 401 }
      );
    }

    // If workspaceId provided — team member or own workspace login
    if (workspaceId) {
      if (workspaceId === "own" || workspaceId === user.id) {
        if (user.role !== "admin") {
          return NextResponse.json({ error: "Access denied" }, { status: 403 });
        }
        const token = createTokenForUser(user.id, "admin", ["*"]);
        await setAuthCookie(token);
        return NextResponse.json({
          success: true,
          role: "admin",
          permissions: ["*"],
        });
      }

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
          { error: "You are not a member of this workspace" },
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
        action: "login",
        section: "auth",
        userEmail: user.email,
        userName: user.name,
        details: { role: membership.role, workspaceId },
        req: request,
      });

      return NextResponse.json({
        success: true,
        role: membership.role,
        permissions: membership.permissions,
        workspaceId,
      });
    }

    // No workspaceId — check if user has any memberships
    const memberships = await prisma.workspaceMembership.findMany({
      where: { userId: user.id, isActive: true },
      select: {
        workspaceId: true,
        role: true,
        permissions: true,
      },
    });

    // If user has memberships, return them for workspace selector
    if (memberships.length > 0) {
      // Also fetch workspace owner names for display
      const workspaceOwnerIds = memberships.map((m) => m.workspaceId);
      const workspaceOwners = await prisma.user.findMany({
        where: { id: { in: workspaceOwnerIds } },
        select: { id: true, name: true, email: true },
      });

      const workspaceList: any[] = [];
      if (user.role === "admin") {
        workspaceList.push({
          workspaceId: "own",
          workspaceName: `${user.name} (My Workspace)`,
          workspaceEmail: user.email,
          role: "admin",
          permissions: ["*"],
        });
      }

      workspaceList.push(
        ...memberships.map((m) => {
          const owner = workspaceOwners.find((o) => o.id === m.workspaceId);
          return {
            workspaceId: m.workspaceId,
            workspaceName: owner?.name ? `${owner.name}'s Workspace` : "Workspace",
            workspaceEmail: owner?.email,
            role: m.role,
            permissions: m.permissions,
          };
        })
      );

      return NextResponse.json({
        success: false,
        requiresWorkspaceSelection: true,
        workspaces: workspaceList,
        user: { id: user.id, name: user.name, email: user.email },
      });
    }

    // User is admin with no other memberships — log directly into own workspace
    if (user.role === "admin") {
      const token = createTokenForUser(user.id, "admin", ["*"]);
      await setAuthCookie(token);
      return NextResponse.json({
        success: true,
        role: "admin",
        permissions: ["*"],
      });
    }

    // User has no memberships and no admin role — cannot login via email/pass
    return NextResponse.json(
      { error: "No workspace access found. Please use Google Sign-In." },
      { status: 403 }
    );
  } catch (error) {
    console.error("Login error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

