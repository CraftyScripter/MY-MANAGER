import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { recomputeDashboardStats } from "@/lib/stats";

// 1x1 transparent GIF pixel
const PIXEL = Buffer.from(
  "R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7",
  "base64"
);

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    // Update seen status only once
    await prisma.contactEnquiry.updateMany({
      where: { id, replied: true, seen: false },
      data: {
        seen: true,
        seenAt: new Date(),
      },
    });

    recomputeDashboardStats().catch(console.error);

    return new NextResponse(PIXEL, {
      status: 200,
      headers: {
        "Content-Type": "image/gif",
        "Cache-Control": "no-store, no-cache, must-revalidate, proxy-revalidate",
        Pragma: "no-cache",
        Expires: "0",
      },
    });
  } catch {
    // Still return pixel even on error so email clients don't retry
    return new NextResponse(PIXEL, {
      status: 200,
      headers: { "Content-Type": "image/gif" },
    });
  }
}
