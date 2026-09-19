import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { verifyEmailDns } from "@/lib/emailVerifier";

export async function GET(request: Request) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const email = searchParams.get("email");

  if (!email) {
    return NextResponse.json(
      { error: "Email query parameter is required" },
      { status: 400 }
    );
  }

  try {
    const result = await verifyEmailDns(email);
    return NextResponse.json(result);
  } catch (error) {
    console.error("Email verification error:", error);
    return NextResponse.json(
      { error: "Internal verification error" },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await request.json();
    const email = body?.email;

    if (!email || typeof email !== "string") {
      return NextResponse.json(
        { error: "Valid email is required in request body" },
        { status: 400 }
      );
    }

    const result = await verifyEmailDns(email, {
      blockDisposable: Boolean(body?.blockDisposable),
    });

    return NextResponse.json(result);
  } catch (error) {
    console.error("Email verification error:", error);
    return NextResponse.json(
      { error: "Internal verification error" },
      { status: 500 }
    );
  }
}
