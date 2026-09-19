import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { logActivity } from "@/lib/activity";

export async function PUT(request: Request) {
  try {
    const user = await getCurrentUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    if (user.id === "admin") {
      return NextResponse.json(
        { error: "Admin profile cannot be updated this way" },
        { status: 403 }
      );
    }

    const body = await request.json();
    const { name, phone } = body;

    if (!name || typeof name !== "string") {
      return NextResponse.json(
        { error: "Name is required" },
        { status: 400 }
      );
    }

    const updated = await prisma.user.update({
      where: { id: user.id },
      data: {
        name: name.trim(),
        phone: phone?.trim() || null,
      },
      select: {
        name: true,
        phone: true,
      },
    });

    await logActivity({
      action: "update_profile",
      section: "auth",
      user,
      details: { name: updated.name, phone: updated.phone },
      req: request,
    });

    return NextResponse.json({ success: true, user: updated });
  } catch (error) {
    console.error("Profile update error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

