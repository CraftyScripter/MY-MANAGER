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

// Generate URL-friendly slug
function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

// GET - List all form projects
export async function GET() {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const projects = await prisma.formProject.findMany({
      include: {
        schema: true,
        apiKey: { select: { apiKey: true, isActive: true, lastUsed: true } },
        _count: { select: { submissions: true } },
      },
      orderBy: { createdAt: "desc" },
    });

    return NextResponse.json({ projects });
  } catch (error) {
    console.error("Error fetching form projects:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

// POST - Create a new form project
export async function POST(request: Request) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const { name, description, useDefaultSchema, fields } = body;

    if (!name || typeof name !== "string" || name.trim().length === 0) {
      return NextResponse.json({ error: "Project name is required" }, { status: 400 });
    }

    // Generate unique slug
    let slug = slugify(name.trim());
    const existing = await prisma.formProject.findUnique({ where: { slug } });
    if (existing) {
      slug = `${slug}-${Date.now().toString(36)}`;
    }

    // Create project with optional schema and API key
    const project = await prisma.formProject.create({
      data: {
        name: name.trim(),
        slug,
        description: description || null,
        useDefaultSchema: useDefaultSchema !== false,
        schema: useDefaultSchema === false && fields
          ? { create: { fields } }
          : undefined,
        apiKey: {
          create: { apiKey: generateApiKey() },
        },
      },
      include: {
        schema: true,
        apiKey: { select: { apiKey: true, isActive: true } },
      },
    });

    return NextResponse.json({ project }, { status: 201 });
  } catch (error) {
    console.error("Error creating form project:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
