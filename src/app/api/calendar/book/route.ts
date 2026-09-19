import { NextResponse } from "next/server";
import { createAdminCalendarBooking } from "@/lib/googleCalendarService";
import { getCurrentUser } from "@/lib/auth";

export async function POST(request: Request) {
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

    // Check if booked by authenticated user (team member or admin)
    const currentUser = await getCurrentUser();
    const bookedByRole = currentUser
      ? currentUser.role === "admin"
        ? "admin"
        : "team_member"
      : "client";
    const bookedByEmail = currentUser?.email || undefined;

    const summary = title || `Strategy Session with ${clientName}`;

    const appointment = await createAdminCalendarBooking({
      summary,
      description,
      startTime,
      endTime,
      clientName,
      clientEmail,
      clientPhone,
      timeZone: timeZone || "UTC",
      bookedByRole,
      bookedByEmail,
      notes,
    });

    return NextResponse.json({
      success: true,
      appointment,
      meetLink: appointment.meetLink,
    });
  } catch (error: any) {
    console.error("Booking API error:", error);
    return NextResponse.json(
      { error: error?.message || "Failed to create calendar booking" },
      { status: 500 }
    );
  }
}
