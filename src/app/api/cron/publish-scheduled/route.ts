import { NextRequest, NextResponse } from "next/server";
import { processDueScheduledPosts } from "@/lib/instagramScheduler";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET(request: NextRequest) {
  return handleCron(request);
}

export async function POST(request: NextRequest) {
  return handleCron(request);
}

async function handleCron(request: NextRequest) {
  try {
    const cronSecret = process.env.CRON_SECRET;
    const authHeader = request.headers.get("authorization");
    const searchSecret = request.nextUrl.searchParams.get("secret");
    const isVercelCron = Boolean(request.headers.get("x-vercel-cron"));

    // If CRON_SECRET is configured, verify the request
    if (cronSecret) {
      const isBearerValid = authHeader === `Bearer ${cronSecret}`;
      const isQueryValid = searchSecret === cronSecret;

      if (!isBearerValid && !isQueryValid && !isVercelCron) {
        return NextResponse.json(
          { error: "Unauthorized: Invalid or missing cron secret" },
          { status: 401 }
        );
      }
    }

    const result = await processDueScheduledPosts();

    return NextResponse.json({
      success: true,
      timestamp: new Date().toISOString(),
      ...result,
    });
  } catch (error: any) {
    console.error("[Cron Publish-Scheduled] Error:", error);
    return NextResponse.json(
      { error: error?.message || "Internal server error" },
      { status: 500 }
    );
  }
}
