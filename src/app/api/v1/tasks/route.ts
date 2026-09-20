import { NextResponse } from "next/server";
import { getCurrentUser, getEffectiveWorkspaceAdminId } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

const VALID_SCOPES = ["PERSONAL", "CLIENT"] as const;
const VALID_CATEGORIES = [
  "DEVELOPMENT",
  "SOCIAL_MEDIA",
  "LEAD_GENERATION",
  "OPERATIONS",
  "UI_UX_DESIGN",
  "PERSONAL_ADMIN",
] as const;
const VALID_PRIORITIES = ["LOW", "MEDIUM", "HIGH", "URGENT"] as const;
const VALID_STATUSES = ["TODO", "IN_PROGRESS", "DONE", "CANCELLED"] as const;

export async function POST(request: Request) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Strict multi-tenant isolation: inject workspace ID from authenticated session
    const workspaceId = getEffectiveWorkspaceAdminId(user);
    const createdBy = user.id;

    const body = await request.json().catch(() => ({}));
    const {
      title,
      description,
      scope = "CLIENT",
      category = "OPERATIONS",
      priority = "MEDIUM",
      due_date,
      dueDate,
      assignee_ids,
      assigneeIds,
      sub_tasks,
      subTasks,
      status = "TODO",
      is_private,
      isPrivate,
    } = body;

    // Validate required fields
    if (!title || typeof title !== "string" || title.trim().length === 0) {
      return NextResponse.json(
        { error: "Task title is required" },
        { status: 400 }
      );
    }

    const resolvedScope = VALID_SCOPES.includes(scope) ? scope : "CLIENT";
    const resolvedCategory = VALID_CATEGORIES.includes(category)
      ? category
      : "OPERATIONS";
    const resolvedPriority = VALID_PRIORITIES.includes(priority)
      ? priority
      : "MEDIUM";
    const resolvedStatus = VALID_STATUSES.includes(status) ? status : "TODO";

    // Handle due date
    const rawDueDate = due_date || dueDate;
    let resolvedDueDate: Date | null = null;
    if (rawDueDate) {
      const parsedDate = new Date(rawDueDate);
      if (!isNaN(parsedDate.getTime())) {
        resolvedDueDate = parsedDate;
      }
    }

    // Handle subtasks
    const rawSubTasks = Array.isArray(sub_tasks)
      ? sub_tasks
      : Array.isArray(subTasks)
      ? subTasks
      : [];

    const resolvedSubTasks = rawSubTasks.map((st: { step?: number; title?: string; completed?: boolean }, idx: number) => ({
      step: typeof st.step === "number" ? st.step : idx + 1,
      title: String(st.title || `Step ${idx + 1}`),
      completed: Boolean(st.completed),
    }));

    // Handle Personal Scope & Privacy enforcement
    const isPersonalScope =
      resolvedScope === "PERSONAL" ||
      is_private === true ||
      isPrivate === true;

    let finalAssigneeIds: string[] = [];

    if (isPersonalScope) {
      // Personal tasks are strictly assigned to the creator
      finalAssigneeIds = [createdBy];
    } else {
      const rawAssignees = Array.isArray(assignee_ids)
        ? assignee_ids
        : Array.isArray(assigneeIds)
        ? assigneeIds
        : [];

      // Validate that assignees belong to this workspace
      const validMemberships = await prisma.workspaceMembership.findMany({
        where: { workspaceId },
        select: { userId: true },
      });
      const validUserIds = new Set([
        workspaceId, // Workspace owner
        ...validMemberships.map((m) => m.userId),
        user.id,
      ]);

      finalAssigneeIds = rawAssignees.filter(
        (id: string) => typeof id === "string" && validUserIds.has(id)
      );

      if (finalAssigneeIds.length === 0) {
        finalAssigneeIds = [createdBy];
      }
    }

    // Persist the task
    const task = await prisma.task.create({
      data: {
        workspaceId,
        createdBy,
        title: title.trim(),
        description: typeof description === "string" ? description.trim() : null,
        scope: isPersonalScope ? "PERSONAL" : resolvedScope,
        category: resolvedCategory,
        priority: resolvedPriority,
        dueDate: resolvedDueDate,
        assigneeIds: finalAssigneeIds,
        subTasks: resolvedSubTasks,
        status: resolvedStatus,
        isPrivate: isPersonalScope,
      },
    });

    return NextResponse.json(
      {
        success: true,
        task: {
          ...task,
          due_date: task.dueDate ? task.dueDate.toISOString() : null,
          assignee_ids: task.assigneeIds,
          sub_tasks: task.subTasks,
        },
      },
      { status: 201 }
    );
  } catch (error) {
    console.error("Create task error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

export async function GET() {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Multi-tenant isolation: resolve workspace ID from session context
    const workspaceId = getEffectiveWorkspaceAdminId(user);

    // Personal Scope Visibility:
    // 1. Client tasks (scope: "CLIENT", isPrivate: false) are visible within the workspace.
    // 2. Personal tasks (scope: "PERSONAL" or isPrivate: true) are ONLY visible to their creator.
    const tasks = await prisma.task.findMany({
      where: {
        workspaceId,
        OR: [
          { scope: "CLIENT", isPrivate: false },
          { createdBy: user.id },
        ],
      },
      orderBy: { createdAt: "desc" },
    });

    // Format response matching expected schema
    const formattedTasks = tasks.map((t) => ({
      id: t.id,
      workspace_id: t.workspaceId,
      created_by: t.createdBy,
      title: t.title,
      description: t.description,
      scope: t.scope,
      category: t.category,
      priority: t.priority,
      due_date: t.dueDate ? t.dueDate.toISOString() : null,
      assignee_ids: t.assigneeIds,
      sub_tasks: t.subTasks,
      status: t.status,
      is_private: t.isPrivate,
      created_at: t.createdAt.toISOString(),
      updated_at: t.updatedAt.toISOString(),
    }));

    return NextResponse.json({
      success: true,
      tasks: formattedTasks,
    });
  } catch (error) {
    console.error("Fetch tasks error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
