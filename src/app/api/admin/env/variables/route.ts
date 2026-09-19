import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { encrypt } from "@/lib/encryption";
import { getCurrentUser, checkPermission } from "@/lib/auth";

export async function GET(request: Request) {
  const user = await getCurrentUser();
  if (!user || !checkPermission(user, "env")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  try {
    const { searchParams } = new URL(request.url);
    const environmentId = searchParams.get("environmentId");
    const search = searchParams.get("search");

    if (!environmentId) {
      return NextResponse.json({ error: "environmentId is required" }, { status: 400 });
    }

    const where: Record<string, unknown> = { environmentId };

    if (search) {
      where.OR = [
        { key: { contains: search } },
        { description: { contains: search } },
      ];
    }

    const variables = await prisma.environmentVariable.findMany({
      where,
      orderBy: { key: "asc" },
      select: {
        id: true,
        key: true,
        description: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    return NextResponse.json({ variables });
  } catch (error) {
    console.error("Fetch env variables error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user || !checkPermission(user, "env", "write")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  try {
    const body = await request.json();
    const { environmentId, key, value, description } = body;

    if (!environmentId || typeof environmentId !== "string") {
      return NextResponse.json({ error: "Environment ID is required" }, { status: 400 });
    }

    if (!key || typeof key !== "string" || key.trim().length === 0) {
      return NextResponse.json({ error: "Variable key is required" }, { status: 400 });
    }

    if (!/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(key.trim())) {
      return NextResponse.json(
        { error: "Key must start with a letter or underscore and contain only letters, numbers, and underscores" },
        { status: 400 }
      );
    }

    if (value === undefined || value === null || typeof value !== "string") {
      return NextResponse.json({ error: "Variable value is required" }, { status: 400 });
    }

    const environment = await prisma.environment.findUnique({ where: { id: environmentId } });
    if (!environment) {
      return NextResponse.json({ error: "Environment not found" }, { status: 404 });
    }

    const existingKey = await prisma.environmentVariable.findFirst({
      where: { environmentId, key: key.trim() },
    });
    if (existingKey) {
      return NextResponse.json(
        { error: `A variable with key "${key.trim()}" already exists` },
        { status: 409 }
      );
    }

    const encryptedValue = encrypt(value);

    const variable = await prisma.environmentVariable.create({
      data: {
        environmentId,
        key: key.trim(),
        value: encryptedValue,
        description: description?.trim() || null,
      },
    });

    console.log(`Env variable created: ${variable.id} (key: ${key.trim()})`);

    return NextResponse.json({ success: true, variable }, { status: 201 });
  } catch (error) {
    console.error("Create env variable error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
