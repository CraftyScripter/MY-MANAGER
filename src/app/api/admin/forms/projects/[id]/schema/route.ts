import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";

// PUT - Create or update schema for a project
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
    const { fields, useDefaultSchema } = body;

    const project = await prisma.formProject.findUnique({ where: { id } });
    if (!project) {
      return NextResponse.json({ error: "Project not found" }, { status: 404 });
    }

    // Validate fields array
    if (!Array.isArray(fields) || fields.length === 0) {
      return NextResponse.json(
        { error: "Fields must be a non-empty array" },
        { status: 400 }
      );
    }

    // Validate each field has required properties
    for (const field of fields) {
      if (!field.key || !field.label || !field.type) {
        return NextResponse.json(
          { error: "Each field must have key, label, and type" },
          { status: 400 }
        );
      }
    }

    // Check for duplicate keys
    const keys = fields.map((f: any) => f.key);
    const uniqueKeys = new Set(keys);
    if (uniqueKeys.size !== keys.length) {
      return NextResponse.json(
        { error: "Duplicate field keys are not allowed" },
        { status: 400 }
      );
    }

    // Upsert schema
    const schema = await prisma.formSchema.upsert({
      where: { projectId: id },
      update: { fields },
      create: { projectId: id, fields },
    });

    // Update useDefaultSchema flag if provided
    if (useDefaultSchema !== undefined) {
      await prisma.formProject.update({
        where: { id },
        data: { useDefaultSchema },
      });
    }

    return NextResponse.json({ schema });
  } catch (error) {
    console.error("Error updating form schema:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

// DELETE - Remove custom schema (revert to default)
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

    await prisma.formSchema.deleteMany({ where: { projectId: id } });
    await prisma.formProject.update({
      where: { id },
      data: { useDefaultSchema: true },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error deleting form schema:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
