import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { sendReplyEmail } from "@/lib/nodemailer";
import { recomputeDashboardStats } from "@/lib/stats";
import { getCurrentUser, checkPermission } from "@/lib/auth";
import { logActivity } from "@/lib/activity";

export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user || !checkPermission(user, "leads", "write")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  try {
    const body = await request.json();
    const { enquiryId, replyBody } = body;

    if (!enquiryId || typeof enquiryId !== "string") {
      return NextResponse.json(
        { error: "Enquiry ID is required" },
        { status: 400 }
      );
    }

    if (!replyBody || typeof replyBody !== "string" || replyBody.trim().length === 0) {
      return NextResponse.json(
        { error: "Reply body is required" },
        { status: 400 }
      );
    }

    const enquiry = await prisma.contactEnquiry.findUnique({
      where: { id: enquiryId },
    });

    if (!enquiry) {
      return NextResponse.json(
        { error: "Enquiry not found" },
        { status: 404 }
      );
    }

    const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || "http://localhost:3000";
    const trackPixelUrl = `${baseUrl}/api/admin/track/${enquiry.id}/pixel`;

    await sendReplyEmail(
      enquiry.email,
      `Re: Your inquiry from ${enquiry.platform}`,
      `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <p>Hello ${enquiry.name},</p>
          <p>Thank you for reaching out to us via <strong>${enquiry.platform}</strong>.</p>
          <hr style="border: none; border-top: 1px solid #eee; margin: 20px 0;" />
          <p><strong>Your message:</strong></p>
          <blockquote style="color: #666; border-left: 3px solid #ddd; padding-left: 12px; margin: 16px 0;">
            ${enquiry.message}
          </blockquote>
          <hr style="border: none; border-top: 1px solid #eee; margin: 20px 0;" />
          <p><strong>Our reply:</strong></p>
          <p>${replyBody.trim()}</p>
          <br />
          <p>Best regards,<br />My Manager Support Team</p>
        </div>
        <img src="${trackPixelUrl}" width="1" height="1" style="display:none;" alt="" />
      `
    );

    const updated = await prisma.contactEnquiry.update({
      where: { id: enquiryId },
      data: {
        replied: true,
        replyMessage: replyBody.trim(),
      },
    });

    recomputeDashboardStats().catch(console.error);

    await logActivity({
      action: "reply_enquiry",
      section: "forms",
      user,
      details: { enquiryId, email: enquiry.email, name: enquiry.name, platform: enquiry.platform },
      req: request,
    });

    return NextResponse.json({ success: true, enquiry: updated });
  } catch (error) {

    console.error("Reply error:", error);
    return NextResponse.json(
      { error: "Failed to send reply" },
      { status: 500 }
    );
  }
}
