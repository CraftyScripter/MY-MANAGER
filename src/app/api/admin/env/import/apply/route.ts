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
    const { environmentId, variables, strategy } = body;

    if (!environmentId || typeof environmentId !== "string") {
      return NextResponse.json({ error: "environmentId is required" }, { status: 400 });
    }

    if (!Array.isArray(variables) || variables.length === 0) {
      return NextResponse.json({ error: "variables array is required" }, { status: 400 });
    }

    if (!strategy || !["skip", "update"].includes(strategy)) {
      return NextResponse.json(
        { error: "strategy must be 'skip' or 'update'" },
        { status: 400 }
      );
    }

    const environment = await prisma.environment.findUnique({ where: { id: environmentId } });
    if (!environment) {
      return NextResponse.json({ error: "Environment not found" }, { status: 404 });
    }

    const existingVars = await prisma.environmentVariable.findMany({
      where: { environmentId },
      select: { id: true, key: true },
    });
    const existingKeyMap = new Map(existingVars.map((v) => [v.key, v.id]));

    let created = 0;
    let updated = 0;
    let skipped = 0;

    for (const item of variables) {
      if (!item.key || typeof item.value !== "string") {
        skipped++;
        continue;
      }

      const encryptedValue = encrypt(item.value);

      if (existingKeyMap.has(item.key)) {
        if (strategy === "skip") {
          skipped++;
        } else {
          await prisma.environmentVariable.update({
            where: { id: existingKeyMap.get(item.key)! },
            data: { value: encryptedValue },
          });
          updated++;
        }
      } else {
        await prisma.environmentVariable.create({
          data: {
            environmentId,
            key: item.key,
            value: encryptedValue,
            description: item.description || null,
          },
        });
        created++;
      }
    }

    await prisma.envAuditLog.create({
      data: {
        environmentId,
        action: "Import",
        adminUser: user.name,
        details: `Imported ${created} new, updated ${updated}, skipped ${skipped}`,
      },
    });

    console.log(`Env import applied: created=${created}, updated=${updated}, skipped=${skipped}`);

    return NextResponse.json({ success: true, created, updated, skipped });
  } catch (error) {
    console.error("Import apply error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
