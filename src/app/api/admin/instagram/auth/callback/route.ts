import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { logActivity } from "@/lib/activity";
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
    let userId = "admin";
    if (state) {
      try {
        const decoded = JSON.parse(Buffer.from(state, "base64").toString("utf-8"));
        if (decoded.userId) userId = decoded.userId;
      } catch {}
    }

    const { redirectUri } = getInstagramConfig(host, protocol);

    // 1. First try Direct Instagram code exchange (no Facebook page needed!)
    try {
      const { accessToken, tokenExpiresAt, profile } = await handleInstagramCodeExchange(
        code,
        redirectUri
      );

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
    } catch (directError: any) {
      console.warn("Direct Instagram code exchange error, trying Facebook Pages fallback:", directError?.message);
    }

    // 2. Fallback to Facebook Pages & Instagram Business account flow
    const metaAppId = process.env.META_APP_ID || process.env.INSTAGRAM_APP_ID || "";
    const metaAppSecret = process.env.META_APP_SECRET || process.env.INSTAGRAM_APP_SECRET || "";

    const tokenUrl = new URL("https://graph.facebook.com/v19.0/oauth/access_token");
    tokenUrl.searchParams.set("client_id", metaAppId);
    tokenUrl.searchParams.set("client_secret", metaAppSecret);
    tokenUrl.searchParams.set("redirect_uri", redirectUri);
    tokenUrl.searchParams.set("code", code);

    const tokenRes = await fetch(tokenUrl.toString(), { method: "GET" });
    const tokenData = await tokenRes.json();

    if (!tokenRes.ok || !tokenData.access_token) {
      throw new Error(tokenData.error?.message || "Failed to exchange token with Meta / Instagram");
    }

    const shortLivedToken = tokenData.access_token;
    const longLivedUrl = new URL("https://graph.facebook.com/v19.0/oauth/access_token");
    longLivedUrl.searchParams.set("grant_type", "fb_exchange_token");
    longLivedUrl.searchParams.set("client_id", metaAppId);
    longLivedUrl.searchParams.set("client_secret", metaAppSecret);
    longLivedUrl.searchParams.set("fb_exchange_token", shortLivedToken);

    const longLivedRes = await fetch(longLivedUrl.toString(), { method: "GET" });
    const longLivedData = await longLivedRes.json();
    const accessToken = longLivedData.access_token || shortLivedToken;
    const tokenExpiresAt = new Date(Date.now() + (longLivedData.expires_in || 5184000) * 1000);

    const pagesUrl = new URL("https://graph.facebook.com/v19.0/me/accounts");
    pagesUrl.searchParams.set(
      "fields",
      "id,name,access_token,instagram_business_account{id,username,name,profile_picture_url,followers_count,follows_count,media_count}"
    );
    pagesUrl.searchParams.set("access_token", accessToken);

    const pagesRes = await fetch(pagesUrl.toString(), { method: "GET" });
    const pagesData = await pagesRes.json();
    const pages = pagesData.data || [];

    let connectedUsername = "";
    for (const page of pages) {
      if (page.instagram_business_account?.id) {
        const ig = page.instagram_business_account;
        const pageToken = page.access_token || accessToken;
        const username = ig.username || "instagram_user";
        connectedUsername = username;

        await prisma.instagramAccount.upsert({
          where: { instagramId: ig.id },
          create: {
            userId,
            instagramId: ig.id,
            username,
            name: ig.name || page.name,
            profilePictureUrl: ig.profile_picture_url || null,
            accessToken: pageToken,
            tokenExpiresAt,
            pageId: page.id,
            pageName: page.name,
            followersCount: ig.followers_count || 0,
            followsCount: ig.follows_count || 0,
            mediaCount: ig.media_count || 0,
          },
          update: {
            userId,
            username,
            name: ig.name || page.name,
            profilePictureUrl: ig.profile_picture_url || null,
            accessToken: pageToken,
            tokenExpiresAt,
            pageId: page.id,
            pageName: page.name,
            followersCount: ig.followers_count || 0,
            followsCount: ig.follows_count || 0,
            mediaCount: ig.media_count || 0,
            updatedAt: new Date(),
          },
        });
      }
    }

    if (!connectedUsername) {
      throw new Error("No Instagram account connected");
    }

    const redirectUrl = new URL(adminInstagramUrl);
    redirectUrl.searchParams.set("status", "connected");
    redirectUrl.searchParams.set("username", connectedUsername);
    return NextResponse.redirect(redirectUrl.toString());
  } catch (error: any) {
    console.error("Instagram OAuth callback handling failed:", error);
    const redirectUrl = new URL(adminInstagramUrl);
    redirectUrl.searchParams.set("error", error.message || "Failed to complete Instagram connection");
    return NextResponse.redirect(redirectUrl.toString());
  }
}
