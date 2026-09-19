import { NextResponse } from "next/server";
import {
  listAdminCalendarEvents,
  createAdminCalendarBooking,
} from "@/lib/googleCalendarService";
import { getCurrentUser } from "@/lib/auth";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET(request: Request) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { searchParams } = new URL(request.url);
    const timeMin = searchParams.get("timeMin") || undefined;
    const timeMax = searchParams.get("timeMax") || undefined;

    const events = await listAdminCalendarEvents({
      timeMin,
      timeMax,
      preferredUserId: user.id,
    });

    return NextResponse.json(
      {
        success: true,
        events,
      },
      {
        headers: {
          "Cache-Control": "no-store, no-cache, must-revalidate, proxy-revalidate",
          Pragma: "no-cache",
          Expires: "0",
        },
      }
    );
  } catch (error: any) {
    console.error("Calendar events list error:", error);
    return NextResponse.json(
      { error: error?.message || "Failed to fetch calendar events" },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await request.json();
    const {
      title,
      description,
      startTime,
      endTime,
      clientName,
      clientEmail,
      clientPhone,
      timeZone,
      notes,
    } = body;

    if (!startTime || !endTime || !clientName || !clientEmail) {
      return NextResponse.json(
        { error: "Missing required fields: startTime, endTime, clientName, clientEmail" },
        { status: 400 }
      );
    }

    const appointment = await createAdminCalendarBooking({
      summary: title || `Meeting with ${clientName}`,
      description,
      startTime,
      endTime,
      clientName,
      clientEmail,
      clientPhone,
      timeZone: timeZone || "UTC",
      bookedByRole: user.role === "admin" ? "admin" : "team_member",
      bookedByEmail: user.email,
      notes,
      preferredUserId: user.id,
    });

    return NextResponse.json({
      success: true,
      appointment,
      meetLink: appointment.meetLink,
    });
  } catch (error: any) {
    console.error("Create calendar event error:", error);
    return NextResponse.json(
      { error: error?.message || "Failed to create calendar event" },
      { status: 500 }
    );
  }
}
