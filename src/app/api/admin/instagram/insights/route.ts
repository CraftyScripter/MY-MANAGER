import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser, getEffectiveWorkspaceAdminId } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { fetchInstagramMediaInsights, fetchInstagramAccountInsights } from "@/lib/instagram";

export async function GET(request: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const mediaId = searchParams.get("mediaId");
    const mediaType = searchParams.get("mediaType") || "IMAGE";
    const accountId = searchParams.get("accountId");

    const workspaceId = getEffectiveWorkspaceAdminId(user);
    const account = accountId
      ? await prisma.instagramAccount.findFirst({ where: { id: accountId, userId: workspaceId } })
      : await prisma.instagramAccount.findFirst({ where: { userId: workspaceId }, orderBy: { updatedAt: "desc" } });

    if (!account) {
      return NextResponse.json({ error: "No connected Instagram account found" }, { status: 404 });
    }

    // Media-level insights
    if (mediaId) {
      const mediaInsights = await fetchInstagramMediaInsights(mediaId, account.accessToken, mediaType);
      return NextResponse.json({ mediaId, insights: mediaInsights });
    }

    // Account-level insights
    const accountInsights = await fetchInstagramAccountInsights(account.instagramId, account.accessToken);
    return NextResponse.json({ accountId: account.id, insights: accountInsights });
  } catch (error: any) {
    console.error("Failed to load insights:", error);
    return NextResponse.json(
      { error: error.message || "Failed to load insights" },
      { status: 500 }
    );
  }
}
