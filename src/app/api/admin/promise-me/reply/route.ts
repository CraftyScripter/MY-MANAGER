import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { sendReplyEmail } from "@/lib/nodemailer";
import { recomputeDashboardStats } from "@/lib/stats";
import { getCurrentUser, checkPermission } from "@/lib/auth";
import { logActivity } from "@/lib/activity";

export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user || !checkPermission(user, "forms", "write")) {
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

    const enquiry = await prisma.promiseMeEnquiry.findUnique({
      where: { id: enquiryId },
    });

    if (!enquiry) {
      return NextResponse.json(
        { error: "Enquiry not found" },
        { status: 404 }
      );
    }

    const buildTypes = enquiry.whatAreYouLookingToBuild.join(", ");

    await sendReplyEmail(
      enquiry.email,
      `Re: Your ${buildTypes} project enquiry`,
      `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <p>Hello ${enquiry.name},</p>
          <p>Thank you for your interest in <strong>${buildTypes}</strong> with <strong>${enquiry.company}</strong>.</p>
          <hr style="border: none; border-top: 1px solid #eee; margin: 20px 0;" />
          <p><strong>Your project details:</strong></p>
          <blockquote style="color: #666; border-left: 3px solid #ddd; padding-left: 12px; margin: 16px 0;">
            ${enquiry.projectDetailsOrRequirement}
          </blockquote>
          <hr style="border: none; border-top: 1px solid #eee; margin: 20px 0;" />
          <p><strong>Our reply:</strong></p>
          <p>${replyBody.trim()}</p>
          <br />
          <p>Best regards,<br />My Manager Team</p>
        </div>
      `
    );

    const updated = await prisma.promiseMeEnquiry.update({
      where: { id: enquiryId },
      data: {
        replied: true,
        replyMessage: replyBody.trim(),
      },
    });

    recomputeDashboardStats().catch(console.error);

    await logActivity({
      action: "reply_promisemee_enquiry",
      section: "forms",
      user,
      details: { enquiryId, email: enquiry.email, name: enquiry.name, company: enquiry.company },
      req: request,
    });

    return NextResponse.json({ success: true, enquiry: updated });
  } catch (error) {
    console.error("Promise Me reply error:", error);
    return NextResponse.json(
      { error: "Failed to send reply" },
      { status: 500 }
    );
  }
}

