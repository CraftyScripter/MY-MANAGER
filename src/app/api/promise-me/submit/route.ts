import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { recomputeDashboardStats } from "@/lib/stats";
import { verifyEmailDns } from "@/lib/emailVerifier";

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
};

export async function OPTIONS() {
  return new NextResponse(null, {
    status: 204,
    headers: corsHeaders,
  });
}

export async function POST(request: Request) {
  try {
    let body: any;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json(
        { error: "Invalid JSON body" },
        { status: 400, headers: corsHeaders }
      );
    }

    const {
      platform,
      name,
      email,
      message,
      phone,
      phone_whatsapp,
      phoneNumber,
      subject,
      project_details_or_requirement,
    } = body || {};

    // 1. Platform is strictly required
    if (!platform || typeof platform !== "string" || platform.trim().length === 0) {
      return NextResponse.json(
        { error: "Platform name is required (e.g. 'ilovecalculator', 'portfolio')" },
        { status: 400, headers: corsHeaders }
      );
    }

    // 2. Name is required
    if (!name || typeof name !== "string" || name.trim().length === 0) {
      return NextResponse.json(
        { error: "Name is required" },
        { status: 400, headers: corsHeaders }
      );
    }

    // 3. Auto Mail Verifier: verify email format and active DNS MX records
    const verification = await verifyEmailDns(email.trim());
    if (!verification.valid) {
      return NextResponse.json(
        {
          error: `Email verification failed: ${verification.reason || "The domain does not have active mail servers (DNS/MX lookup failed)"}`,
          details: {
            status: verification.status,
            domain: verification.domain,
            reason: verification.reason,
          },
        },
        { status: 400, headers: corsHeaders }
      );
    }

    // 4. Message is required (also accepts project_details_or_requirement for backwards compatibility)
    const finalMessage = (message || project_details_or_requirement || "").toString().trim();
    if (!finalMessage) {
      return NextResponse.json(
        { error: "Message is required" },
        { status: 400, headers: corsHeaders }
      );
    }

    // Optional fields
    const finalPhone = (phone || phone_whatsapp || phoneNumber || "").toString().trim() || null;
    const finalSubject = (subject || "").toString().trim() || null;

    const enquiry = await prisma.contactEnquiry.create({
      data: {
        platform: platform.trim(),
        name: name.trim(),
        email: verification.email || email.trim().toLowerCase(),
        message: finalMessage,
        phone: finalPhone,
        subject: finalSubject,
        emailVerified: verification.valid,
        emailMx: verification.primaryMx || null,
      },
    });

    recomputeDashboardStats().catch(console.error);

    return NextResponse.json(
      {
        success: true,
        id: enquiry.id,
        emailVerified: verification.valid,
        mailExchange: verification.primaryMx || null,
      },
      { status: 201, headers: corsHeaders }
    );
  } catch (error) {
    console.error("Form submit error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500, headers: corsHeaders }
    );
  }
}
