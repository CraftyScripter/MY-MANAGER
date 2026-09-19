import { NextRequest, NextResponse } from "next/server";

interface TokenPayload {
  userId: string;
  role: string;
  permissions: string[];
  expires: number;
}

async function verifyToken(token: string): Promise<TokenPayload | null> {
  try {
    const [encoded, signature] = token.split(".");
    if (!encoded || !signature) return null;

    const secret = process.env.TOKEN_SECRET;
    if (!secret) return null;

    const key = await crypto.subtle.importKey(
      "raw",
      new TextEncoder().encode(secret),
      { name: "HMAC", hash: "SHA-256" },
      false,
      ["verify"]
    );

    const valid = await crypto.subtle.verify(
      "HMAC",
      key,
      hexToArrayBuffer(signature),
      new TextEncoder().encode(encoded)
    );

    if (!valid) return null;

    const payload: TokenPayload = JSON.parse(atob(encoded));
    if (!payload.expires || Date.now() > payload.expires) return null;
    if (!payload.userId || !payload.role) return null;

    return payload;
  } catch {
    return null;
  }
}

function hexToArrayBuffer(hex: string): ArrayBuffer {
  const bytes = new Uint8Array(hex.length / 2);
  for (let i = 0; i < hex.length; i += 2) {
    bytes[i / 2] = parseInt(hex.substring(i, i + 2), 16);
  }
  return bytes.buffer;
}

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Exclude public paths
  if (
    pathname === "/" ||
    pathname === "/login" ||
    pathname === "/signup" ||
    pathname === "/book" ||
    pathname.startsWith("/auth/") ||
    pathname.startsWith("/api/admin/auth/") ||
    pathname.startsWith("/api/admin/google/auth/") ||
    pathname.startsWith("/api/admin/instagram/auth/callback") ||
    pathname.startsWith("/api/admin/track/") ||
    pathname.startsWith("/api/admin/team/accept-invitation") ||
    pathname.startsWith("/api/calendar/") ||
    pathname.startsWith("/api/contact/") ||
    pathname.startsWith("/api/forms/") ||
    pathname.startsWith("/api/promise-me/") ||
    pathname === "/accept-invitation"
  ) {
    return NextResponse.next();
  }


  // Protect all /admin and /api/admin routes
  if (pathname.startsWith("/admin") || pathname.startsWith("/api/admin")) {
    const token = request.cookies.get("admin_token")?.value;

    if (!token) {
      if (pathname.startsWith("/api/")) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
      }
      const loginUrl = new URL("/", request.url);
      loginUrl.searchParams.set("from", pathname);
      return NextResponse.redirect(loginUrl);
    }

    const payload = await verifyToken(token);

    if (!payload) {
      if (pathname.startsWith("/api/")) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
      }
      const loginUrl = new URL("/", request.url);
      loginUrl.searchParams.set("from", pathname);
      return NextResponse.redirect(loginUrl);
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/admin/:path*", "/api/admin/:path*"],
};
