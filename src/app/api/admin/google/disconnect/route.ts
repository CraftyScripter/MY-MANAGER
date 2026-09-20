import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function POST() {
  try {
    const user = await getCurrentUser();
    if (!user || user.role !== "admin" || user.workspaceId) {
      return NextResponse.json(
        { error: "Only workspace administrators can disconnect Google accounts" },
        { status: 403 }
      );
    }
    const userId = user.id;

    await prisma.googleSheetLink.deleteMany({
      where: { userId },
    });

    await prisma.googleAccount.deleteMany({
      where: { userId },
    });

    return NextResponse.json({
      success: true,
      message: "Google account disconnected successfully",
    });
  } catch (error: any) {
    return NextResponse.json(
      { error: error?.message || "Failed to disconnect Google account" },
      { status: 500 }
    );
  }
}
