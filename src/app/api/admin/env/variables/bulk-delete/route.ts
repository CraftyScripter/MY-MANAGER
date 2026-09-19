import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser, checkPermission } from "@/lib/auth";

export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user || !checkPermission(user, "env", "write")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  try {
    const body = await request.json();
    const { ids, confirm } = body;

    if (!Array.isArray(ids) || ids.length === 0) {
      return NextResponse.json({ error: "ids array is required" }, { status: 400 });
    }

    if (confirm !== "DELETE") {
      return NextResponse.json(
        { error: "Type DELETE to confirm bulk deletion" },
        { status: 400 }
      );
    }

    const variables = await prisma.environmentVariable.findMany({
      where: { id: { in: ids } },
      select: { id: true, key: true, environmentId: true },
    });

    if (variables.length === 0) {
      return NextResponse.json({ error: "No variables found" }, { status: 404 });
    }

    await prisma.environmentVariable.deleteMany({
      where: { id: { in: ids } },
    });

    await prisma.envAuditLog.createMany({
      data: variables.map((v) => ({
        variableId: v.id,
        environmentId: v.environmentId,
        action: "BulkDelete",
        adminUser: user.name,
        details: `Deleted variable "${v.key}"`,
      })),
    });

    console.log(`Env variables bulk deleted: ${variables.length} variables`);

    return NextResponse.json({ success: true, deleted: variables.length });
  } catch (error) {
    console.error("Bulk delete env variables error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
