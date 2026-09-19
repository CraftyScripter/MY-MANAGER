import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";

// GET - Get a single project with details
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;
    const project = await prisma.formProject.findUnique({
      where: { id },
      include: {
        schema: true,
        apiKey: { select: { apiKey: true, isActive: true, lastUsed: true } },
        _count: { select: { submissions: true } },
      },
    });

    if (!project) {
      return NextResponse.json({ error: "Project not found" }, { status: 404 });
    }

    return NextResponse.json({ project });
  } catch (error) {
    console.error("Error fetching form project:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

// PUT - Update a project
export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;
    const body = await request.json();
    const { name, description, isActive, useDefaultSchema } = body;

    const existing = await prisma.formProject.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json({ error: "Project not found" }, { status: 404 });
    }

    const updated = await prisma.formProject.update({
      where: { id },
      data: {
        ...(name && { name: name.trim() }),
        ...(description !== undefined && { description: description || null }),
        ...(isActive !== undefined && { isActive }),
        ...(useDefaultSchema !== undefined && { useDefaultSchema }),
      },
      include: {
        schema: true,
        apiKey: { select: { apiKey: true, isActive: true } },
      },
    });

    return NextResponse.json({ project: updated });
  } catch (error) {
    console.error("Error updating form project:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

// DELETE - Delete a project and all its data
export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;
    const existing = await prisma.formProject.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json({ error: "Project not found" }, { status: 404 });
    }

    // Delete all related data (cascading should handle this, but let's be explicit)
    await prisma.formSubmission.deleteMany({ where: { projectId: id } });
    await prisma.formApiKey.deleteMany({ where: { projectId: id } });
    await prisma.formSchema.deleteMany({ where: { projectId: id } });
    await prisma.formProject.delete({ where: { id } });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error deleting form project:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
