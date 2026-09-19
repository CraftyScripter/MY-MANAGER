import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { parseEnvFile } from "@/lib/envParser";
import { getCurrentUser, checkPermission } from "@/lib/auth";

export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user || !checkPermission(user, "env")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  try {
    const body = await request.json();
    const { environmentId, content } = body;

    if (!environmentId || typeof environmentId !== "string") {
      return NextResponse.json({ error: "environmentId is required" }, { status: 400 });
    }

    if (!content || typeof content !== "string") {
      return NextResponse.json({ error: "content is required" }, { status: 400 });
    }

    const environment = await prisma.environment.findUnique({ where: { id: environmentId } });
    if (!environment) {
      return NextResponse.json({ error: "Environment not found" }, { status: 404 });
    }

    const parsed = parseEnvFile(content);

    const existingVars = await prisma.environmentVariable.findMany({
      where: { environmentId },
      select: { key: true },
    });
    const existingKeys = new Set(existingVars.map((v) => v.key));

    const newVars: Array<{ key: string; value: string }> = [];
    const existingVarsList: Array<{ key: string; value: string }> = [];

    for (const item of parsed.valid) {
      if (existingKeys.has(item.key)) {
        existingVarsList.push(item);
      } else {
        newVars.push(item);
      }
    }

    return NextResponse.json({
      preview: {
        new: newVars,
        newCount: newVars.length,
        existing: existingVarsList,
        existingCount: existingVarsList.length,
        invalid: parsed.invalid,
        invalidCount: parsed.invalid.length,
      },
    });
  } catch (error) {
    console.error("Import preview error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
