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
    const { projectId, name } = body;

    if (!projectId || typeof projectId !== "string") {
      return NextResponse.json({ error: "Project ID is required" }, { status: 400 });
    }

    if (!name || typeof name !== "string" || name.trim().length === 0) {
      return NextResponse.json({ error: "Environment name is required" }, { status: 400 });
    }

    const project = await prisma.envProject.findUnique({ where: { id: projectId } });
    if (!project) {
      return NextResponse.json({ error: "Project not found" }, { status: 404 });
    }

    const existingEnv = await prisma.environment.findFirst({
      where: { projectId, name: name.trim() },
    });
    if (existingEnv) {
      return NextResponse.json(
        { error: "An environment with this name already exists in this project" },
        { status: 409 }
      );
    }

    const environment = await prisma.environment.create({
      data: { projectId, name: name.trim() },
    });

    console.log(`Environment created: ${environment.id} (${name.trim()}) in project ${projectId}`);

    return NextResponse.json({ success: true, environment }, { status: 201 });
  } catch (error) {
    console.error("Create environment error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
