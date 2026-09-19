import { NextResponse } from "next/server";
import { cancelAdminCalendarBooking } from "@/lib/googleCalendarService";
import { getCurrentUser } from "@/lib/auth";

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { id } = await params;
    const cancelled = await cancelAdminCalendarBooking(id, user.id);

    return NextResponse.json({
      success: true,
      appointment: cancelled,
    });
  } catch (error: any) {
    console.error("Cancel appointment error:", error);
    return NextResponse.json(
      { error: error?.message || "Failed to cancel appointment" },
      { status: 500 }
    );
  }
}
