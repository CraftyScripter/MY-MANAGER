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
  invitationLink: string,
  options?: {
    inviterName?: string;
    inviterEmail?: string;
    permissions?: string[];
    workspaceName?: string;
  }
) {
  const { inviterName, inviterEmail, permissions, workspaceName } = options || {};

  // Build permissions HTML
  const SECTION_LABELS: Record<string, string> = {
    leads: "Spreadsheets",
    forms: "Forms / Enquiries",
    credentials: "Password Manager",
    finance: "Finance / Payments",
    calendar: "Calendar & Meetings",
    env: "Environment Variables",
    team: "Team Management",
    activity_log: "Activity Log",
    instagram: "Instagram",
    settings: "Settings",
  };

  let permissionsHtml = "";
  if (permissions && permissions.length > 0) {
    const uniqueSections = [...new Set(permissions.map((p) => p.split(":")[0]))];
    const permissionItems = uniqueSections
      .filter((s) => SECTION_LABELS[s])
      .map((section) => {
        const hasWrite = permissions.some(
          (p) => p === `${section}:write` || p === section || p === "*" || p === "all:write"
        );
        const label = SECTION_LABELS[section] || section;
        return `
          <tr>
            <td style="padding:6px 0;">
              <table role="presentation" cellpadding="0" cellspacing="0">
                <tr>
                  <td style="width:18px;vertical-align:middle;">
                    <div style="width:16px;height:16px;border-radius:4px;background-color:${hasWrite ? "#dcfce7" : "#dbeafe"};text-align:center;line-height:16px;font-size:10px;color:${hasWrite ? "#16a34a" : "#2563eb"};">
                      ${hasWrite ? "✓" : "○"}
                    </div>
                  </td>
                  <td style="padding-left:8px;font-size:13px;color:#3f3f46;font-weight:500;">
                    ${label}
                  </td>
                  <td style="padding-left:6px;">
                    <span style="font-size:10px;font-weight:600;padding:2px 6px;border-radius:4px;background-color:${hasWrite ? "#f0fdf4" : "#eff6ff"};color:${hasWrite ? "#15803d" : "#1d4ed8"};border:1px solid ${hasWrite ? "#bbf7d0" : "#bfdbfe"};">
                      ${hasWrite ? "Full Access" : "View Only"}
                    </span>
                  </td>
                </tr>
              </table>
            </td>
          </tr>`;
      })
      .join("");

    permissionsHtml = `
      <table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="margin:16px 0 24px;border:1px solid #e4e4e7;border-radius:8px;overflow:hidden;">
        <tr>
          <td style="padding:12px 16px;background-color:#fafafa;border-bottom:1px solid #e4e4e7;">
            <p style="margin:0;font-size:12px;font-weight:700;color:#71717a;text-transform:uppercase;letter-spacing:0.05em;">Your Assigned Permissions</p>
          </td>
        </tr>
        <tr>
          <td style="padding:8px 16px;">
            <table role="presentation" cellpadding="0" cellspacing="0" width="100%">
              ${permissionItems}
            </table>
          </td>
        </tr>
      </table>`;
  }

  const html = `
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>You're Invited to My Manager</title>
    </head>
    <body style="margin:0;padding:0;background-color:#f4f4f5;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#f4f4f5;padding:40px 20px;">
        <tr>
          <td align="center">
            <table role="presentation" width="480" cellpadding="0" cellspacing="0" style="background-color:#ffffff;border-radius:16px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,0.06);">

              <!-- Header with Logo -->
              <tr>
                <td style="padding:40px 40px 32px;text-align:center;background:linear-gradient(135deg,#18181b 0%,#27272a 100%);">
                  <img src="https://my-manager-eight.vercel.app/myicon.png" alt="My Manager" width="56" height="56" style="border-radius:14px;box-shadow:0 4px 12px rgba(0,0,0,0.2);margin-bottom:16px;" />
                  <h1 style="margin:0;color:#ffffff;font-size:22px;font-weight:700;letter-spacing:-0.01em;">You're Invited!</h1>
                  <p style="margin:8px 0 0;color:#a1a1aa;font-size:13px;">Join the team on My Manager</p>
                </td>
              </tr>

              <!-- Body -->
              <tr>
                <td style="padding:32px 40px;">
                  <p style="margin:0 0 6px;color:#18181b;font-size:15px;font-weight:500;">Hi ${name} 👋</p>
                  <p style="margin:0 0 20px;color:#52525b;font-size:14px;line-height:1.65;">
                    ${inviterName ? `<strong style="color:#18181b;">${inviterName}</strong>` : "Your admin"}${inviterEmail ? ` <span style="color:#a1a1aa;">(${inviterEmail})</span>` : ""} has invited you to collaborate on <strong style="color:#18181b;">My Manager</strong>${workspaceName ? ` for <strong style="color:#18181b;">${workspaceName}</strong>` : ""}.
                  </p>
                  <p style="margin:0 0 24px;color:#52525b;font-size:14px;line-height:1.65;">
                    Set your password below to activate your account and start collaborating with your team.
                  </p>

                  <!-- Permissions -->
                  ${permissionsHtml}

                  <!-- Button -->
                  <table role="presentation" cellpadding="0" cellspacing="0" width="100%">
                    <tr>
                      <td align="center" style="padding:8px 0;">
                        <a href="${invitationLink}" style="display:inline-block;padding:14px 36px;background-color:#2563eb;color:#ffffff;font-size:14px;font-weight:600;text-decoration:none;border-radius:10px;letter-spacing:0.01em;box-shadow:0 2px 8px rgba(37,99,235,0.3);">
                          Set Up Your Account →
                        </a>
                      </td>
                    </tr>
                  </table>

                  <p style="margin:20px 0 0;color:#a1a1aa;font-size:12px;line-height:1.5;text-align:center;">
                    This invitation link expires in <strong style="color:#71717a;">48 hours</strong>.
                  </p>
                </td>
              </tr>

              <!-- Footer -->
              <tr>
                <td style="padding:24px 40px;border-top:1px solid #e4e4e7;background-color:#fafafa;">
                  <table role="presentation" cellpadding="0" cellspacing="0" width="100%">
                    <tr>
                      <td align="center">
                        <img src="https://my-manager-eight.vercel.app/myicon.png" alt="My Manager" width="24" height="24" style="border-radius:6px;margin-bottom:8px;" />
                        <p style="margin:0 0 4px;color:#71717a;font-size:12px;font-weight:600;">My Manager</p>
                        <p style="margin:0;color:#a1a1aa;font-size:11px;">The Unified Workspace for Modern Teams</p>
                      </td>
                    </tr>
                  </table>
                  <p style="margin:16px 0 0;color:#d4d4d8;font-size:11px;line-height:1.5;text-align:center;">
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

  return sendReplyEmail(to, `You're invited to join ${workspaceName || "My Manager"}`, html);
}
