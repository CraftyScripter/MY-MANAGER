import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { encrypt } from "@/lib/encryption";
import { recomputeDashboardStats } from "@/lib/stats";
import { getCurrentUser, checkPermission } from "@/lib/auth";
import { logActivity } from "@/lib/activity";

const VALID_CATEGORIES = [
  "Social Media",
  "Email",
  "Website",
  "Hosting",
  "Domain",
  "Payment",
  "Google Services",
  "Business Tools",
  "Other",
];

export async function GET(request: Request) {
  const user = await getCurrentUser();
  if (!user || !checkPermission(user, "credentials")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  try {
    const { searchParams } = new URL(request.url);
    const search = searchParams.get("search");
    const category = searchParams.get("category");
    const sort = searchParams.get("sort") || "updatedAt";
    const order = searchParams.get("order") || "desc";
    const page = parseInt(searchParams.get("page") || "1", 10);
    const limit = parseInt(searchParams.get("limit") || "20", 10);
    const skip = (page - 1) * limit;

    const where: Record<string, unknown> = {};

    if (category && category !== "all") {
      where.category = category;
    }

    if (search) {
      where.OR = [
        { accountName: { contains: search } },
        { username: { contains: search } },
      ];
    }

    const orderBy: Record<string, string> = {};
    if (sort === "accountName" || sort === "category" || sort === "updatedAt" || sort === "createdAt") {
      orderBy[sort] = order === "asc" ? "asc" : "desc";
    } else {
      orderBy.updatedAt = "desc";
    }

    const [credentials, total, categories] = await Promise.all([
      prisma.credential.findMany({
        where,
        orderBy,
        skip,
        take: limit,
        select: {
          id: true,
          accountName: true,
          category: true,
          username: true,
          accountUrl: true,
          createdAt: true,
          updatedAt: true,
          links: { select: { id: true, title: true, url: true } },
        },
      }),
      prisma.credential.count({ where }),
      prisma.credential.findMany({
        select: { category: true },
        distinct: ["category"],
      }),
    ]);

    return NextResponse.json({
      credentials,
      categories: categories.map((c: { category: string }) => c.category),
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    console.error("Fetch credentials error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user || !checkPermission(user, "credentials", "write")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  try {
    const body = await request.json();
    const { accountName, category, username, password, accountUrl, notes, links } = body;

    if (!accountName || typeof accountName !== "string" || accountName.trim().length === 0) {
      return NextResponse.json({ error: "Account name is required" }, { status: 400 });
    }

    if (!category || !VALID_CATEGORIES.includes(category)) {
      return NextResponse.json({ error: "Valid category is required" }, { status: 400 });
    }

    if (!username || typeof username !== "string" || username.trim().length === 0) {
      return NextResponse.json({ error: "Username is required" }, { status: 400 });
    }

    if (!password || typeof password !== "string" || password.trim().length === 0) {
      return NextResponse.json({ error: "Password is required" }, { status: 400 });
    }

    const encryptedPassword = encrypt(password);

    const credential = await prisma.credential.create({
      data: {
        accountName: accountName.trim(),
        category,
        username: username.trim(),
        password: encryptedPassword,
        accountUrl: accountUrl?.trim() || null,
        notes: notes?.trim() || null,
        links: {
          create: Array.isArray(links)
            ? links
                .filter((l: { title?: string; url?: string }) => l.title && l.url)
                .map((l: { title: string; url: string }) => ({
                  title: l.title.trim(),
                  url: l.url.trim(),
                }))
            : [],
        },
      },
      include: { links: true },
    });

    console.log(`Credential created: ${credential.id} (${accountName.trim()})`);

    recomputeDashboardStats().catch(console.error);

    await logActivity({
      action: "create_credential",
      section: "credentials",
      user,
      details: { credentialId: credential.id, accountName: credential.accountName, category: credential.category },
      req: request,
    });

    return NextResponse.json({ success: true, credential }, { status: 201 });
  } catch (error) {

    console.error("Create credential error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
