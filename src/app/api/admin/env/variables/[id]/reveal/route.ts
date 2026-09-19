import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { decrypt } from "@/lib/encryption";
import { getCurrentUser, checkPermission } from "@/lib/auth";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getCurrentUser();
  if (!user || !checkPermission(user, "env")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  try {
    const { id } = await params;

    const variable = await prisma.environmentVariable.findUnique({
      where: { id },
      select: { id: true, key: true, value: true, environmentId: true },
    });

    if (!variable) {
      return NextResponse.json({ error: "Variable not found" }, { status: 404 });
    }

    const decryptedValue = decrypt(variable.value);

    await prisma.envAuditLog.create({
      data: {
        variableId: id,
        environmentId: variable.environmentId,
        action: "Reveal",
        adminUser: user.name,
        details: `Revealed value for key "${variable.key}"`,
      },
    });

    console.log(`Env variable revealed: ${id} (key: ${variable.key})`);

    return NextResponse.json({ value: decryptedValue });
  } catch (error) {
    console.error("Reveal env variable error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
