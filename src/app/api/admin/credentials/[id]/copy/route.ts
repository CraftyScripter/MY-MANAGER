import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { decrypt } from "@/lib/encryption";
import { getCurrentUser, checkPermission } from "@/lib/auth";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getCurrentUser();
  if (!user || !checkPermission(user, "credentials")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  try {
    const { id } = await params;

    const credential = await prisma.credential.findUnique({
      where: { id },
      select: { id: true, accountName: true, password: true },
    });

    if (!credential) {
      return NextResponse.json({ error: "Credential not found" }, { status: 404 });
    }

    const decryptedPassword = decrypt(credential.password);

    console.log(`Password copied for credential: ${id} (${credential.accountName})`);

    return NextResponse.json({ password: decryptedPassword });
  } catch (error) {
    console.error("Copy password error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
