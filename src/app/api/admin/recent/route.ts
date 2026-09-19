import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser, checkPermission } from "@/lib/auth";

export async function GET() {
  const user = await getCurrentUser();
  if (!user || !checkPermission(user, "dashboard")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  try {
    const [recentContacts, recentTools] = await Promise.all([
      prisma.contactEnquiry.findMany({
        orderBy: { createdAt: "desc" },
      take: 3,
    }),
    prisma.promiseMeEnquiry.findMany({
      orderBy: { createdAt: "desc" },
      take: 3,
    }),
  ]);

  const all = [
    ...recentContacts.map((e) => ({ ...e, _type: "contact" })),
    ...recentTools.map((e) => ({ ...e, _type: "tool" })),
  ]
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
    .slice(0, 5);

    return NextResponse.json({ enquiries: all });
  } catch (error) {
    console.error("Recent enquiries error:", error);
    return NextResponse.json({ enquiries: [] });
  }
}
