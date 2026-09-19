import nodemailer from "nodemailer";

let _transporter: ReturnType<typeof nodemailer.createTransport> | null = null;

function getTransporter() {
  if (!_transporter) {
    _transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: Number(process.env.SMTP_PORT) || 587,
      secure: Number(process.env.SMTP_PORT) === 465,
      requireTLS: Number(process.env.SMTP_PORT) !== 465,
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS,
      },
    });
  }
  return _transporter;
}

export async function sendReplyEmail(
  to: string,
  subject: string,
  html: string
) {
  const transporter = getTransporter();
  const info = await transporter.sendMail({
    from: process.env.SMTP_FROM,
    to,
    subject,
    html,
  });
  return info;
}

export async function sendInvitationEmail(
  to: string,
  name: string,
  invitationLink: string
) {
  const html = `
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>You're Invited</title>
    </head>
    <body style="margin:0;padding:0;background-color:#f4f4f5;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#f4f4f5;padding:40px 20px;">
        <tr>
          <td align="center">
            <table role="presentation" width="480" cellpadding="0" cellspacing="0" style="background-color:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 1px 3px rgba(0,0,0,0.08);">
              <!-- Header -->
              <tr>
                <td style="padding:40px 40px 32px;text-align:center;border-bottom:1px solid #e4e4e7;">
                  <h1 style="margin:0;color:#18181b;font-size:22px;font-weight:700;letter-spacing:-0.01em;">You're Invited</h1>
                  <p style="margin:8px 0 0;color:#71717a;font-size:14px;">Join the team on My Manager</p>
                </td>
              </tr>

              <!-- Body -->
              <tr>
                <td style="padding:32px 40px;">
                  <p style="margin:0 0 8px;color:#18181b;font-size:15px;font-weight:500;">Hi ${name},</p>
                  <p style="margin:0 0 24px;color:#52525b;font-size:14px;line-height:1.6;">
                    You've been invited to collaborate on My Manager. Your admin has set up an account for you with specific access permissions.
                  </p>
                  <p style="margin:0 0 24px;color:#52525b;font-size:14px;line-height:1.6;">
                    Click the button below to set your password and activate your account. This link will expire in 48 hours.
                  </p>

                  <!-- Button -->
                  <table role="presentation" cellpadding="0" cellspacing="0" width="100%">
                    <tr>
                      <td align="center">
                        <a href="${invitationLink}" style="display:inline-block;padding:12px 32px;background-color:#18181b;color:#ffffff;font-size:14px;font-weight:600;text-decoration:none;border-radius:8px;letter-spacing:0.01em;">
                          Set Up Your Account
                        </a>
                      </td>
                    </tr>
                  </table>
                </td>
              </tr>

              <!-- Footer -->
              <tr>
                <td style="padding:24px 40px;border-top:1px solid #e4e4e7;">
                  <p style="margin:0;color:#a1a1aa;font-size:12px;line-height:1.5;text-align:center;">
                    If you didn't expect this invitation, you can safely ignore this email. No action is required.
                  </p>
                </td>
              </tr>
            </table>
          </td>
        </tr>
      </table>
    </body>
    </html>
  `;

  return sendReplyEmail(to, "You've been invited to join My Manager", html);
}
