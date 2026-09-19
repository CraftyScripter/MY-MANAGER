import { NextResponse } from "next/server";
import { verifyEmailDns } from "@/lib/emailVerifier";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
};

export async function OPTIONS() {
  return new NextResponse(null, {
    status: 204,
    headers: corsHeaders,
  });
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const email = searchParams.get("email");

  if (!email) {
    return NextResponse.json(
      { error: "Email parameter is required" },
      { status: 400, headers: corsHeaders }
    );
  }

  try {
    const result = await verifyEmailDns(email);
    return NextResponse.json(result, { headers: corsHeaders });
  } catch (error) {
    console.error("Public verify email error:", error);
    return NextResponse.json(
      { error: "Verification lookup failed" },
      { status: 500, headers: corsHeaders }
    );
  }
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

    const email = body?.email;
    if (!email || typeof email !== "string") {
      return NextResponse.json(
        { error: "Email is required" },
        { status: 400, headers: corsHeaders }
      );
    }

    const result = await verifyEmailDns(email, {
      blockDisposable: Boolean(body?.blockDisposable),
    });

    return NextResponse.json(result, { headers: corsHeaders });
  } catch (error) {
    console.error("Public verify email error:", error);
    return NextResponse.json(
      { error: "Verification lookup failed" },
      { status: 500, headers: corsHeaders }
    );
  }
}
