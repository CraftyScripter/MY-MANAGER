import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function POST() {
  try {
    const user = await getCurrentUser();
    const userId = user?.id || "admin";

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
