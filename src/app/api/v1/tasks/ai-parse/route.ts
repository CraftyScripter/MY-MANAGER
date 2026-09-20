import { NextResponse } from "next/server";
import { getCurrentUser, getEffectiveWorkspaceAdminId } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { parseTaskWithGemini } from "@/lib/gemini-task-parser";

export async function POST(request: Request) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json().catch(() => ({}));
    const { input } = body;

    if (!input || typeof input !== "string" || input.trim().length === 0) {
      return NextResponse.json(
        { error: "Natural language input prompt is required" },
        { status: 400 }
      );
    }

    // Strict multi-tenant isolation: resolve workspace from session context
    const workspaceId = getEffectiveWorkspaceAdminId(user);

    // Fetch workspace owner and active team members
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

    const teamMembers: Array<{ id: string; name: string; email: string; role: string }> = [];

    if (workspaceOwner) {
      teamMembers.push({
        id: workspaceOwner.id,
        name: workspaceOwner.name,
        email: workspaceOwner.email,
        role: "admin",
      });
    }

    for (const m of memberships) {
      if (workspaceOwner && m.user.id === workspaceOwner.id) continue;
      teamMembers.push({
        id: m.user.id,
        name: m.user.name,
        email: m.user.email,
        role: m.role,
      });
    }

    const parsedTask = await parseTaskWithGemini(input.trim(), {
      currentUser: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
      },
      teamMembers,
      workspace: {
        id: workspaceId,
        name: workspaceOwner?.name ? `${workspaceOwner.name}'s Workspace` : `Workspace ${workspaceId}`,
      },
      currentTime: new Date().toISOString(),
    });

    return NextResponse.json({
      success: true,
      task: parsedTask,
    });
  } catch (error) {
    console.error("AI task parsing error:", error);
    return NextResponse.json(
      { error: (error as Error)?.message || "Failed to parse natural language task" },
      { status: 500 }
    );
  }
}
