import { NextResponse } from "next/server";
import { getGoogleAuthUrl, getGoogleClientId } from "@/lib/google";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const state = searchParams.get("state") || "admin";

    const clientId = getGoogleClientId();
    if (!clientId) {
      return NextResponse.json(
        {
          error: "Google Client ID is not configured. Please set GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET in .env",
        },
        { status: 400 }
      );
    }

    const authUrl = getGoogleAuthUrl(state);
    return NextResponse.json({ authUrl, success: true });
  } catch (error: any) {
    return NextResponse.json(
      { error: error?.message || "Failed to generate Google Auth URL" },
      { status: 500 }
    );
  }
}
