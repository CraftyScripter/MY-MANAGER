import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser, checkPermission } from "@/lib/auth";

const DEFAULT_ENVIRONMENTS = ["Development", "Staging", "Production"];

export async function GET() {
  const user = await getCurrentUser();
  if (!user || !checkPermission(user, "env")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  try {
    const projects = await prisma.envProject.findMany({
      orderBy: { updatedAt: "desc" },
      include: {
        environments: {
          select: { id: true, name: true, _count: { select: { variables: true } } },
        },
      },
    });

    const result = projects.map((p) => ({
      id: p.id,
      name: p.name,
      description: p.description,
      environmentCount: p.environments.length,
      variableCount: p.environments.reduce((sum, e) => sum + e._count.variables, 0),
      createdAt: p.createdAt,
      updatedAt: p.updatedAt,
    }));

    return NextResponse.json({ projects: result });
  } catch (error) {
    console.error("Fetch env projects error:", error);
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
    const { name, description } = body;

    if (!name || typeof name !== "string" || name.trim().length === 0) {
      return NextResponse.json({ error: "Project name is required" }, { status: 400 });
    }

    const project = await prisma.envProject.create({
      data: {
        name: name.trim(),
        description: description?.trim() || null,
        environments: {
          create: DEFAULT_ENVIRONMENTS.map((envName) => ({ name: envName })),
        },
      },
      include: { environments: true },
    });

    console.log(`Env project created: ${project.id} (${name.trim()})`);

    return NextResponse.json({ success: true, project }, { status: 201 });
  } catch (error) {
    console.error("Create env project error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
