import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { encrypt } from "@/lib/encryption";
import { getCurrentUser, checkPermission } from "@/lib/auth";

export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user || !checkPermission(user, "env", "write")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  try {
    const body = await request.json();
    const { environmentId, variables } = body;

    if (!environmentId || typeof environmentId !== "string") {
      return NextResponse.json({ error: "environmentId is required" }, { status: 400 });
    }

    if (!Array.isArray(variables) || variables.length === 0) {
      return NextResponse.json({ error: "variables array is required" }, { status: 400 });
    }

    const environment = await prisma.environment.findUnique({ where: { id: environmentId } });
    if (!environment) {
      return NextResponse.json({ error: "Environment not found" }, { status: 404 });
    }

    const existingVars = await prisma.environmentVariable.findMany({
      where: { environmentId },
      select: { key: true },
    });
    const existingKeys = new Set(existingVars.map((v) => v.key));

    let created = 0;
    let skipped = 0;
    const errors: Array<{ key: string; reason: string }> = [];

    for (const item of variables) {
      if (!item.key || typeof item.key !== "string" || item.key.trim().length === 0) {
        skipped++;
        continue;
      }

      const key = item.key.trim();

      if (!/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(key)) {
        errors.push({ key, reason: "Invalid key name" });
        skipped++;
        continue;
      }

      if (typeof item.value !== "string") {
        errors.push({ key, reason: "Missing value" });
        skipped++;
        continue;
      }

      if (existingKeys.has(key)) {
        skipped++;
        continue;
      }

      const encryptedValue = encrypt(item.value);
      await prisma.environmentVariable.create({
        data: {
          environmentId,
          key,
          value: encryptedValue,
          description: item.description?.trim() || null,
        },
      });
      existingKeys.add(key);
      created++;
    }

    console.log(`Env variables bulk created: ${created} created, ${skipped} skipped in environment ${environmentId}`);

    return NextResponse.json({ success: true, created, skipped, errors });
  } catch (error) {
    console.error("Bulk create env variables error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
