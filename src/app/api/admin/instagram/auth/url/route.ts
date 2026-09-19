import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { getInstagramConfig, getDirectInstagramAuthUrl, getMetaAuthUrl } from "@/lib/instagram";

export async function GET(request: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const mode = searchParams.get("mode") || "direct"; // direct or meta

    const host = request.headers.get("host") || "localhost:3000";
    const protocol = request.headers.get("x-forwarded-proto") || (host.includes("localhost") ? "http" : "https");
    const { appId, redirectUri, isConfigured } = getInstagramConfig(host, protocol);

    if (!isConfigured) {
      return NextResponse.json(
        { error: "Instagram/Meta App credentials (INSTAGRAM_APP_ID/META_APP_ID) are not configured in .env" },
        { status: 400 }
      );
    }

    // State with user info
    const statePayload = Buffer.from(
      JSON.stringify({
        userId: user.id,
        timestamp: Date.now(),
      })
    ).toString("base64");

    const directInstagramAuthUrl = getDirectInstagramAuthUrl(redirectUri, statePayload);
    const metaAuthUrl = getMetaAuthUrl(redirectUri, statePayload);

    const primaryUrl = mode === "meta" ? metaAuthUrl : directInstagramAuthUrl;

    return NextResponse.json({
      authUrl: primaryUrl,
      directInstagramAuthUrl,
      metaAuthUrl,
      redirectUri,
      configured: true,
      appId,
    });
  } catch (error: any) {
    console.error("Failed to generate Instagram OAuth URL:", error);
    return NextResponse.json(
      { error: error.message || "Failed to generate authorization URL" },
      { status: 500 }
    );
  }
}
