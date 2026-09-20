import { NextResponse } from "next/server";
import { getCurrentUser, getEffectiveWorkspaceAdminId } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

interface RouteParams {
  params: Promise<{ id: string }>;
}

export async function PATCH(request: Request, context: RouteParams) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await context.params;
    const workspaceId = getEffectiveWorkspaceAdminId(user);

    // Fetch existing task
    const existingTask = await prisma.task.findUnique({
      where: { id },
    });

    if (!existingTask || existingTask.workspaceId !== workspaceId) {
      return NextResponse.json({ error: "Task not found" }, { status: 404 });
    }

    // Personal scope check: only creator can view or update personal tasks
    if (existingTask.isPrivate && existingTask.createdBy !== user.id) {
      return NextResponse.json({ error: "Task not found" }, { status: 404 });
    }

    const body = await request.json().catch(() => ({}));
    const {
      title,
      description,
      scope,
      status,
      priority,
      category,
      dueDate,
      due_date,
      subTasks,
      sub_tasks,
      assigneeIds,
      assignee_ids,
      is_private,
      isPrivate,
    } = body;

    const updateData: Record<string, unknown> = {};

    if (typeof title === "string" && title.trim().length > 0) {
      updateData.title = title.trim();
    }
    if (description !== undefined) {
      updateData.description = typeof description === "string" ? description.trim() : null;
    }
    if (typeof status === "string") {
      updateData.status = status;
    }
    if (typeof priority === "string") {
      updateData.priority = priority;
    }
    if (typeof category === "string") {
      updateData.category = category;
    }

    // Handle Scope & Privacy updates (PERSONAL vs CLIENT)
    if (scope !== undefined || is_private !== undefined || isPrivate !== undefined) {
      const isPersonal =
        scope === "PERSONAL" || is_private === true || isPrivate === true;

      if (isPersonal) {
        updateData.scope = "PERSONAL";
        updateData.isPrivate = true;
        // Personal tasks are strictly assigned to the creator
        updateData.assigneeIds = [existingTask.createdBy];
      } else {
        updateData.scope = "CLIENT";
        updateData.isPrivate = false;
        const rawAssignees = assigneeIds !== undefined ? assigneeIds : assignee_ids;
        if (Array.isArray(rawAssignees)) {
          updateData.assigneeIds = rawAssignees.length > 0 ? rawAssignees : [existingTask.createdBy];
        }
      }
    } else if (!existingTask.isPrivate) {
      // If scope wasn't changed and it's currently a client task, allow updating assignees
      const rawAssignees = assigneeIds !== undefined ? assigneeIds : assignee_ids;
      if (Array.isArray(rawAssignees)) {
        updateData.assigneeIds = rawAssignees.length > 0 ? rawAssignees : [existingTask.createdBy];
      }
    }

    const rawDueDate = dueDate !== undefined ? dueDate : due_date;
    if (rawDueDate !== undefined) {
      if (rawDueDate) {
        const parsed = new Date(rawDueDate);
        if (!isNaN(parsed.getTime())) {
          updateData.dueDate = parsed;
        }
      } else {
        updateData.dueDate = null;
      }
    }

    const rawSubTasks = subTasks !== undefined ? subTasks : sub_tasks;
    if (Array.isArray(rawSubTasks)) {
      updateData.subTasks = rawSubTasks.map(
        (st: { step?: number; title?: string; completed?: boolean }, idx: number) => ({
          step: typeof st.step === "number" ? st.step : idx + 1,
          title: String(st.title || `Step ${idx + 1}`),
          completed: Boolean(st.completed),
        })
      );
    }

    const updatedTask = await prisma.task.update({
      where: { id },
      data: updateData,
    });

    return NextResponse.json({
      success: true,
      task: {
        id: updatedTask.id,
        workspace_id: updatedTask.workspaceId,
        created_by: updatedTask.createdBy,
        title: updatedTask.title,
        description: updatedTask.description,
        scope: updatedTask.scope,
        category: updatedTask.category,
        priority: updatedTask.priority,
        due_date: updatedTask.dueDate ? updatedTask.dueDate.toISOString() : null,
        assignee_ids: updatedTask.assigneeIds,
        sub_tasks: updatedTask.subTasks,
        status: updatedTask.status,
        is_private: updatedTask.isPrivate,
        created_at: updatedTask.createdAt.toISOString(),
        updated_at: updatedTask.updatedAt.toISOString(),
      },
    });
  } catch (error) {
    console.error("Update task error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

export async function DELETE(request: Request, context: RouteParams) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await context.params;
    const workspaceId = getEffectiveWorkspaceAdminId(user);

    const existingTask = await prisma.task.findUnique({
      where: { id },
    });

    if (!existingTask || existingTask.workspaceId !== workspaceId) {
      return NextResponse.json({ error: "Task not found" }, { status: 404 });
    }

    // Personal scope: only creator can delete
    if (existingTask.isPrivate && existingTask.createdBy !== user.id) {
      return NextResponse.json({ error: "Task not found" }, { status: 404 });
    }

    // Client task: creator or admin can delete
    if (!existingTask.isPrivate && existingTask.createdBy !== user.id && user.role !== "admin") {
      return NextResponse.json(
        { error: "Only task creator or workspace admin can delete this task" },
        { status: 403 }
      );
    }

    await prisma.task.delete({
      where: { id },
    });

    return NextResponse.json({
      success: true,
      message: "Task deleted successfully",
    });
  } catch (error) {
    console.error("Delete task error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
