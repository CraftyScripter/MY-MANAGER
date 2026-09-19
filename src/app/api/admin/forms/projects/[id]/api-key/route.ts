import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";

// Generate a random API key
function generateApiKey(): string {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
  let result = "fb_";
  for (let i = 0; i < 32; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}

// POST - Generate or rotate API key
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;

    const project = await prisma.formProject.findUnique({ where: { id } });
    if (!project) {
      return NextResponse.json({ error: "Project not found" }, { status: 404 });
    }

    // Delete old key if exists
    await prisma.formApiKey.deleteMany({ where: { projectId: id } });

    // Create new key
    const apiKey = await prisma.formApiKey.create({
      data: {
        projectId: id,
        apiKey: generateApiKey(),
      },
    });

    return NextResponse.json({ apiKey: apiKey.apiKey });
  } catch (error) {
    console.error("Error generating API key:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

// PUT - Toggle API key active status
export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;
    const body = await request.json();
    const { isActive } = body;

    const apiKey = await prisma.formApiKey.findUnique({ where: { projectId: id } });
    if (!apiKey) {
      return NextResponse.json({ error: "API key not found" }, { status: 404 });
    }

    const updated = await prisma.formApiKey.update({
      where: { projectId: id },
      data: { isActive },
    });

    return NextResponse.json({ apiKey: updated });
  } catch (error) {
    console.error("Error updating API key:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
