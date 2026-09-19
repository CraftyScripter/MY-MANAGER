import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { encrypt } from "@/lib/encryption";
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
    const { key, value, description } = body;

    const existing = await prisma.environmentVariable.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json({ error: "Variable not found" }, { status: 404 });
    }

    if (key !== undefined && (typeof key !== "string" || key.trim().length === 0)) {
      return NextResponse.json({ error: "Key cannot be empty" }, { status: 400 });
    }

    if (key !== undefined && !/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(key.trim())) {
      return NextResponse.json(
        { error: "Key must start with a letter or underscore and contain only letters, numbers, and underscores" },
        { status: 400 }
      );
    }

    if (key !== undefined && key.trim() !== existing.key) {
      const duplicate = await prisma.environmentVariable.findFirst({
        where: { environmentId: existing.environmentId, key: key.trim(), id: { not: id } },
      });
      if (duplicate) {
        return NextResponse.json(
          { error: `A variable with key "${key.trim()}" already exists` },
          { status: 409 }
        );
      }
    }

    const updateData: Record<string, unknown> = {};
    if (key !== undefined) updateData.key = key.trim();
    if (value !== undefined && typeof value === "string") updateData.value = encrypt(value);
    if (description !== undefined) updateData.description = description?.trim() || null;

    await prisma.environmentVariable.update({ where: { id }, data: updateData });

    console.log(`Env variable updated: ${id}`);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Update env variable error:", error);
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

    const existing = await prisma.environmentVariable.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json({ error: "Variable not found" }, { status: 404 });
    }

    const body = await request.json().catch(() => ({}));
    if (body.confirm !== "DELETE") {
      return NextResponse.json(
        { error: "Type DELETE to confirm" },
        { status: 400 }
      );
    }

    await prisma.environmentVariable.delete({ where: { id } });

    console.log(`Env variable deleted: ${id} (key: ${existing.key})`);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Delete env variable error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
