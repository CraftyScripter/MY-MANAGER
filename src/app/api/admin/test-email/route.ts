import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { sendReplyEmail } from "@/lib/nodemailer";

export async function POST(request: Request) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const { to } = body;

    if (!to || !to.includes("@")) {
      return NextResponse.json({ error: "Valid email required" }, { status: 400 });
    }

    const html = `
      <!DOCTYPE html>
      <html>
      <head><meta charset="utf-8"></head>
      <body style="font-family:-apple-system,sans-serif;padding:40px;background:#f4f4f5;">
        <div style="max-width:480px;margin:0 auto;background:#fff;border-radius:12px;padding:40px;box-shadow:0 1px 3px rgba(0,0,0,0.08);">
          <h1 style="color:#18181b;font-size:22px;margin:0 0 16px;">✅ Email Test Successful</h1>
          <p style="color:#52525b;font-size:14px;line-height:1.6;">
            Hello ${user.name},<br><br>
            This is a test email from <strong>My Manager</strong>.<br>
            Your SMTP configuration is working correctly!
          </p>
          <p style="color:#a1a1aa;font-size:12px;margin-top:24px;">
            Sent at: ${new Date().toLocaleString("en-IN", { timeZone: "Asia/Kolkata" })}
          </p>
        </div>
      </body>
      </html>
    `;

    const info = await sendReplyEmail(to, "My Manager — Email Test ✅", html);

    return NextResponse.json({
      success: true,
      messageId: info.messageId,
      message: `Test email sent to ${to}`,
    });
  } catch (error: any) {
    console.error("Test email error:", error);
    return NextResponse.json(
      { error: error.message || "Failed to send email" },
      { status: 500 }
    );
  }
}
