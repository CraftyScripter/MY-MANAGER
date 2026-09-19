import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { decrypt } from "@/lib/encryption";
import { formatEnvFile } from "@/lib/envParser";
import { getCurrentUser, checkPermission } from "@/lib/auth";

export async function GET(request: Request) {
  const user = await getCurrentUser();
  if (!user || !checkPermission(user, "env")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  try {
    const { searchParams } = new URL(request.url);
    const environmentId = searchParams.get("environmentId");

    if (!environmentId) {
      return NextResponse.json({ error: "environmentId is required" }, { status: 400 });
    }

    const environment = await prisma.environment.findUnique({
      where: { id: environmentId },
      include: { project: true },
    });
    if (!environment) {
      return NextResponse.json({ error: "Environment not found" }, { status: 404 });
    }

    const variables = await prisma.environmentVariable.findMany({
      where: { environmentId },
      orderBy: { key: "asc" },
      select: { key: true, value: true },
    });

    const decrypted = variables.map((v) => ({
      key: v.key,
      value: decrypt(v.value),
    }));

    const envContent = formatEnvFile(decrypted);

    await prisma.envAuditLog.create({
      data: {
        environmentId,
        projectId: environment.projectId,
        action: "Export",
        adminUser: user.name,
        details: `Exported ${variables.length} variables from "${environment.name}"`,
      },
    });

    console.log(`Env exported: ${variables.length} variables from environment ${environmentId}`);

    return new NextResponse(envContent, {
      headers: {
        "Content-Type": "text/plain; charset=utf-8",
        "Content-Disposition": `attachment; filename=".env.${environment.name.toLowerCase().replace(/\s+/g, "-")}"`,
      },
    });
  } catch (error) {
    console.error("Export env error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
