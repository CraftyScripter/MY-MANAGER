import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser, checkPermission } from "@/lib/auth";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getCurrentUser();
  if (!user || !checkPermission(user, "env")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  try {
    const { id } = await params;

    const project = await prisma.envProject.findUnique({
      where: { id },
      include: {
        environments: {
          orderBy: { createdAt: "asc" },
          include: { _count: { select: { variables: true } } },
        },
      },
    });

    if (!project) {
      return NextResponse.json({ error: "Project not found" }, { status: 404 });
    }

    return NextResponse.json({ project });
  } catch (error) {
    console.error("Fetch env project error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

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
    const { name, description } = body;

    const existing = await prisma.envProject.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json({ error: "Project not found" }, { status: 404 });
    }

    if (name !== undefined && (typeof name !== "string" || name.trim().length === 0)) {
      return NextResponse.json({ error: "Project name cannot be empty" }, { status: 400 });
    }

    const updateData: Record<string, unknown> = {};
    if (name !== undefined) updateData.name = name.trim();
    if (description !== undefined) updateData.description = description?.trim() || null;

    await prisma.envProject.update({ where: { id }, data: updateData });

    console.log(`Env project updated: ${id}`);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Update env project error:", error);
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

    const existing = await prisma.envProject.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json({ error: "Project not found" }, { status: 404 });
    }

    const body = await request.json().catch(() => ({}));
    if (body.confirmName !== existing.name) {
      return NextResponse.json(
        { error: "Project name does not match" },
        { status: 400 }
      );
    }

    await prisma.envProject.delete({ where: { id } });

    console.log(`Env project deleted: ${id} (${existing.name})`);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Delete env project error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
