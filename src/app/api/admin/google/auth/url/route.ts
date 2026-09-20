import { NextResponse } from "next/server";
import { getGoogleAuthUrl, getGoogleClientId } from "@/lib/google";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const state = searchParams.get("state") || "admin";
    const prompt = searchParams.get("prompt") || "consent select_account";

    const clientId = getGoogleClientId();
    if (!clientId) {
      return NextResponse.json(
        {
          error: "Google Sign In is temporarily unavailable. Please try again later.",
        },
        { status: 400 }
      );
    }

    const authUrl = getGoogleAuthUrl(state, prompt);
    return NextResponse.json({ authUrl, success: true });
  } catch (error: any) {
    return NextResponse.json(
      { error: "Unable to connect to Google. Please try again." },
      { status: 500 }
    );
  }
}
