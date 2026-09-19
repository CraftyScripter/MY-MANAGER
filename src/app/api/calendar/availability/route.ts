import { NextResponse } from "next/server";
import { getAdminCalendarAvailability } from "@/lib/googleCalendarService";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const date = searchParams.get("date");
    const timeZone = searchParams.get("timeZone") || "UTC";
    const durationParam = searchParams.get("duration");
    const slotDurationMinutes = durationParam ? parseInt(durationParam, 10) : 30;

    if (!date) {
      return NextResponse.json(
        { error: "Missing required 'date' parameter (YYYY-MM-DD)" },
        { status: 400 }
      );
    }

    const result = await getAdminCalendarAvailability({
      dateStr: date,
      timeZone,
      slotDurationMinutes: isNaN(slotDurationMinutes) || slotDurationMinutes <= 0 ? 30 : slotDurationMinutes,
    });

    return NextResponse.json(result, {
      headers: {
        "Cache-Control": "no-store, no-cache, must-revalidate, proxy-revalidate",
        Pragma: "no-cache",
        Expires: "0",
      },
    });
  } catch (error: any) {
    console.error("Availability API error:", error);
    return NextResponse.json(
      { error: error?.message || "Failed to fetch availability" },
      { status: 500 }
    );
  }
}
