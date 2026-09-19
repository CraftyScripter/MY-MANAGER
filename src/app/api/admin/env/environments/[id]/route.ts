import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser, checkPermission } from "@/lib/auth";

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getCurrentUser();
  if (!user || !checkPermission(user, "env", "write")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  try {
    const { id } = await params;
    const body = await request.json();
    const { name } = body;

    const existing = await prisma.environment.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json({ error: "Environment not found" }, { status: 404 });
    }

    if (name !== undefined && (typeof name !== "string" || name.trim().length === 0)) {
      return NextResponse.json({ error: "Environment name cannot be empty" }, { status: 400 });
    }

    if (name !== undefined) {
      const duplicate = await prisma.environment.findFirst({
        where: { projectId: existing.projectId, name: name.trim(), id: { not: id } },
      });
      if (duplicate) {
        return NextResponse.json(
          { error: "An environment with this name already exists" },
          { status: 409 }
        );
      }
    }

    const updateData: Record<string, unknown> = {};
    if (name !== undefined) updateData.name = name.trim();

    await prisma.environment.update({ where: { id }, data: updateData });

    console.log(`Environment updated: ${id}`);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Update environment error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getCurrentUser();
  if (!user || !checkPermission(user, "env", "write")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  try {
    const { id } = await params;

    const existing = await prisma.environment.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json({ error: "Environment not found" }, { status: 404 });
    }

    await prisma.environment.delete({ where: { id } });

    console.log(`Environment deleted: ${id} (${existing.name})`);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Delete environment error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
