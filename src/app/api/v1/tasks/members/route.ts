import { NextResponse } from "next/server";
import { getCurrentUser, getEffectiveWorkspaceAdminId } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET() {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const workspaceId = getEffectiveWorkspaceAdminId(user);

    const [workspaceOwner, memberships] = await Promise.all([
      prisma.user.findUnique({
        where: { id: workspaceId },
        select: { id: true, name: true, email: true, role: true },
      }),
      prisma.workspaceMembership.findMany({
        where: { workspaceId, isActive: true },
        select: {
          role: true,
          user: {
            select: { id: true, name: true, email: true },
          },
        },
      }),
    ]);

    const members: Array<{ id: string; name: string; email: string; role: string }> = [];

    if (workspaceOwner) {
      members.push({
        id: workspaceOwner.id,
        name: workspaceOwner.name,
        email: workspaceOwner.email,
        role: "admin",
      });
    }

    for (const m of memberships) {
      if (workspaceOwner && m.user.id === workspaceOwner.id) continue;
      members.push({
        id: m.user.id,
        name: m.user.name,
        email: m.user.email,
        role: m.role,
      });
    }

    return NextResponse.json({
      success: true,
      members,
      currentUser: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
      },
    });
  } catch (error) {
    console.error("Fetch workspace task members error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
