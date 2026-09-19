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

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getCurrentUser();
  if (!user || !checkPermission(user, "credentials")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  try {
    const { id } = await params;

    const credential = await prisma.credential.findUnique({
      where: { id },
      include: { links: { select: { id: true, title: true, url: true } } },
    });

    if (!credential) {
      return NextResponse.json({ error: "Credential not found" }, { status: 404 });
    }

    return NextResponse.json({ credential });
  } catch (error) {
    console.error("Fetch credential error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getCurrentUser();
  if (!user || !checkPermission(user, "credentials", "write")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  try {
    const { id } = await params;
    const body = await request.json();
    const { accountName, category, username, password, accountUrl, notes, links } = body;

    const existing = await prisma.credential.findUnique({
      where: { id },
      include: { links: true },
    });

    if (!existing) {
      return NextResponse.json({ error: "Credential not found" }, { status: 404 });
    }

    if (accountName !== undefined && (typeof accountName !== "string" || accountName.trim().length === 0)) {
      return NextResponse.json({ error: "Account name cannot be empty" }, { status: 400 });
    }

    if (category !== undefined && !VALID_CATEGORIES.includes(category)) {
      return NextResponse.json({ error: "Invalid category" }, { status: 400 });
    }

    if (username !== undefined && (typeof username !== "string" || username.trim().length === 0)) {
      return NextResponse.json({ error: "Username cannot be empty" }, { status: 400 });
    }

    const updateData: Record<string, unknown> = {};

    if (accountName !== undefined) updateData.accountName = accountName.trim();
    if (category !== undefined) updateData.category = category;
    if (username !== undefined) updateData.username = username.trim();
    if (accountUrl !== undefined) updateData.accountUrl = accountUrl?.trim() || null;
    if (notes !== undefined) updateData.notes = notes?.trim() || null;

    if (password && typeof password === "string" && password.trim().length > 0) {
      updateData.password = encrypt(password);
    }

    await prisma.$transaction(async (tx) => {
      await tx.credential.update({ where: { id }, data: updateData });

      if (Array.isArray(links)) {
        await tx.credentialLink.deleteMany({ where: { credentialId: id } });
        const validLinks = links
          .filter((l: { title?: string; url?: string }) => l.title && l.url)
          .map((l: { title: string; url: string }) => ({
            credentialId: id,
            title: l.title.trim(),
            url: l.url.trim(),
          }));
        if (validLinks.length > 0) {
          await tx.credentialLink.createMany({ data: validLinks });
        }
      }
    });

    recomputeDashboardStats().catch(console.error);

    await logActivity({
      action: "update_credential",
      section: "credentials",
      user,
      details: { credentialId: id, accountName: updateData.accountName || existing.accountName },
      req: request,
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Update credential error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getCurrentUser();
  if (!user || !checkPermission(user, "credentials", "write")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  try {
    const { id } = await params;

    const existing = await prisma.credential.findUnique({ where: { id } });

    if (!existing) {
      return NextResponse.json({ error: "Credential not found" }, { status: 404 });
    }

    await prisma.credential.delete({ where: { id } });

    recomputeDashboardStats().catch(console.error);

    await logActivity({
      action: "delete_credential",
      section: "credentials",
      user,
      details: { credentialId: id, accountName: existing.accountName },
      req: request,
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Delete credential error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

