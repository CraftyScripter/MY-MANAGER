import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { logActivity } from "@/lib/activity";
import { getCurrentUser, getEffectiveWorkspaceAdminId } from "@/lib/auth";
import { handleInstagramCodeExchange, getInstagramConfig } from "@/lib/instagram";

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const code = searchParams.get("code");
  const error = searchParams.get("error");
  const errorReason = searchParams.get("error_reason");
  const errorDescription = searchParams.get("error_description");
  const state = searchParams.get("state");

  const host = request.headers.get("host") || "localhost:3000";
  const protocol = request.headers.get("x-forwarded-proto") || (host.includes("localhost") ? "http" : "https");
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || `${protocol}://${host}`;
  const adminInstagramUrl = `${baseUrl.replace(/\/$/, "")}/admin/instagram`;

  if (error || errorReason) {
    console.error("Instagram OAuth error:", error, errorReason, errorDescription);
    const redirectUrl = new URL(adminInstagramUrl);
    redirectUrl.searchParams.set("error", errorDescription || errorReason || error || "Authorization cancelled");
    return NextResponse.redirect(redirectUrl.toString());
  }

  if (!code) {
    const redirectUrl = new URL(adminInstagramUrl);
    redirectUrl.searchParams.set("error", "Missing authorization code");
    return NextResponse.redirect(redirectUrl.toString());
  }

  try {
    const user = await getCurrentUser();
    let userId = user ? getEffectiveWorkspaceAdminId(user) : "admin";
    if (state) {
      try {
        const decoded = JSON.parse(Buffer.from(state, "base64").toString("utf-8"));
        if (decoded.userId) userId = decoded.userId;
      } catch {}
    }

    const { redirectUri } = getInstagramConfig(host, protocol);

    // Exchange code directly via Instagram Basic / Graph API
    const { accessToken, tokenExpiresAt, profile } = await handleInstagramCodeExchange(
      code,
      redirectUri
    );

    // Save or update in database
    await prisma.instagramAccount.upsert({
      where: { instagramId: profile.id },
      create: {
        userId,
        instagramId: profile.id,
        username: profile.username,
        name: profile.name || profile.username,
        profilePictureUrl: profile.profilePictureUrl || null,
        accessToken,
        tokenExpiresAt,
        mediaCount: profile.mediaCount ?? 0,
        followersCount: profile.followersCount ?? 0,
        followsCount: profile.followsCount ?? 0,
      },
      update: {
        userId,
        username: profile.username,
        name: profile.name || profile.username,
        profilePictureUrl: profile.profilePictureUrl || null,
        accessToken,
        tokenExpiresAt,
        mediaCount: profile.mediaCount ?? 0,
        followersCount: profile.followersCount ?? 0,
        followsCount: profile.followsCount ?? 0,
        updatedAt: new Date(),
      },
    });

    // Log activity
    await logActivity({
      action: "INSTAGRAM_CONNECTED",
      section: "instagram",
      details: `Connected Instagram account @${profile.username}`,
      userEmail: "admin",
      userName: "Admin",
    });

    const redirectUrl = new URL(adminInstagramUrl);
    redirectUrl.searchParams.set("status", "connected");
    redirectUrl.searchParams.set("username", profile.username);
    return NextResponse.redirect(redirectUrl.toString());
  } catch (err: any) {
    console.error("Failed to connect Instagram account:", err);
    const redirectUrl = new URL(adminInstagramUrl);
    redirectUrl.searchParams.set("error", err.message || "Failed to exchange authorization code for Instagram account");
    return NextResponse.redirect(redirectUrl.toString());
  }
}
