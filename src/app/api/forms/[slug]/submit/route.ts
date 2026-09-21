import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifyEmailDns } from "@/lib/emailVerifier";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Api-Key",
};

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: corsHeaders });
}

// Default schema fields
const DEFAULT_FIELDS = [
  { key: "name", label: "Full Name", type: "text", required: true },
  { key: "email", label: "Email", type: "email", required: true },
  { key: "phone", label: "Phone", type: "tel", required: false },
  { key: "message", label: "Message", type: "textarea", required: true },
  { key: "subject", label: "Subject", type: "text", required: false },
];

export async function POST(
  request: Request,
  { params }: { params: Promise<{ slug: string }> }
) {
  try {
    const { slug } = await params;

    // 1. Find the project by slug
    const project = await prisma.formProject.findUnique({
      where: { slug },
      include: { schema: true, apiKey: true },
    });

    if (!project || !project.isActive) {
      return NextResponse.json(
        { error: "Form endpoint not found or inactive" },
        { status: 404, headers: corsHeaders }
      );
    }

    // 2. Optional API key validation (if X-Api-Key header is provided)
    const apiKeyHeader = request.headers.get("X-Api-Key");
    if (apiKeyHeader) {
      if (!project.apiKey || project.apiKey.apiKey !== apiKeyHeader || !project.apiKey.isActive) {
        return NextResponse.json(
          { error: "Invalid or inactive API key" },
          { status: 401, headers: corsHeaders }
        );
      }
      // Update last used timestamp
      await prisma.formApiKey.update({
        where: { id: project.apiKey.id },
        data: { lastUsed: new Date() },
      });
    }

    // 3. Parse request body
    let body: any;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json(
        { error: "Invalid JSON body" },
        { status: 400, headers: corsHeaders }
      );
    }

    // 4. Determine which schema to validate against
    const fields = project.useDefaultSchema
      ? DEFAULT_FIELDS
      : (project.schema?.fields as any[]) || DEFAULT_FIELDS;

    // 5. Validate required fields
    const missingFields: string[] = [];
    for (const field of fields) {
      if (field.required) {
        const value = body[field.key];
        if (!value || (typeof value === "string" && value.trim().length === 0)) {
          missingFields.push(field.label || field.key);
        }
      }
    }

    if (missingFields.length > 0) {
      return NextResponse.json(
        { error: `Missing required fields: ${missingFields.join(", ")}` },
        { status: 400, headers: corsHeaders }
      );
    }

    // 6. Email DNS verification (if email field exists in schema)
    const emailField = fields.find((f: any) => f.type === "email");
    let emailVerified: boolean | null = null;
    let emailMx: string | null = null;

    if (emailField && body[emailField.key]) {
      const verification = await verifyEmailDns(body[emailField.key].trim());
      emailVerified = verification.valid;
      emailMx = verification.primaryMx || null;

      if (!verification.valid) {
        return NextResponse.json(
          {
            error: `Email verification failed: ${verification.reason || "Invalid email domain"}`,
            details: {
              status: verification.status,
              domain: verification.domain,
              reason: verification.reason,
            },
          },
          { status: 400, headers: corsHeaders }
        );
      }
    }

    // 7. Save submission
    const submission = await prisma.formSubmission.create({
      data: {
        projectId: project.id,
        data: body,
        ipAddress: request.headers.get("x-forwarded-for") || request.headers.get("x-real-ip") || null,
        userAgent: request.headers.get("user-agent") || null,
        emailVerified,
        emailMx,
      },
    });
    // Auto-backup after FormBridge submission
    const { on_data_created } = await import("@/lib/autoBackup");
    on_data_created("formSubmission");

    return NextResponse.json(
      {
        success: true,
        id: submission.id,
        emailVerified,
        mailExchange: emailMx,
      },
      { status: 201, headers: corsHeaders }
    );
  } catch (error) {
    console.error("Form submission error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500, headers: corsHeaders }
    );
  }
}
