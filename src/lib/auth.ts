import { cookies } from "next/headers";
import { createHmac, randomBytes } from "crypto";
import bcrypt from "bcryptjs";
import { prisma } from "./prisma";
import { ALL_PERMISSIONS, hasPermission } from "./permissions";

const COOKIE_NAME = "admin_token";
const TOKEN_EXPIRY = 30 * 24 * 60 * 60 * 1000; // 30 days
const HMAC_ALGO = "sha256";

function getTokenSecret(): string {
  const secret = process.env.TOKEN_SECRET;
  if (!secret || secret.length < 32) {
    throw new Error("TOKEN_SECRET must be at least 32 characters");
  }
  return secret;
}

export interface TokenPayload {
  userId: string;
  role: string;
  permissions: string[];
  workspaceId?: string; // null = own workspace (admin), string = member workspace
  expires: number;
}

export interface CurrentUser {
  id: string;
  name: string;
  email: string;
  phone?: string | null;
  role: string;
  permissions: string[];
  workspaceId?: string; // Set when user is acting in a team member workspace
}

export function getEffectiveWorkspaceAdminId(user: CurrentUser): string {
  return user.workspaceId || user.id;
}


function signPayload(payload: TokenPayload): string {
  const data = JSON.stringify(payload);
  const encoded = btoa(data);
  const signature = createHmac(HMAC_ALGO, getTokenSecret())
    .update(encoded)
    .digest("hex");
  return `${encoded}.${signature}`;
}

export function verifySignedToken(token: string): TokenPayload | null {
  try {
    const [encoded, signature] = token.split(".");
    if (!encoded || !signature) return null;

    const expectedSig = createHmac(HMAC_ALGO, getTokenSecret())
      .update(encoded)
      .digest("hex");

    if (signature !== expectedSig) return null;

    const payload: TokenPayload = JSON.parse(atob(encoded));
    if (!payload.expires || Date.now() > payload.expires) return null;
    if (!payload.userId || !payload.role) return null;

    return payload;
  } catch {
    return null;
  }
}

export function createAdminToken(): string {
  const payload: TokenPayload = {
    userId: "admin",
    role: "admin",
    permissions: ALL_PERMISSIONS,
    expires: Date.now() + TOKEN_EXPIRY,
  };
  return signPayload(payload);
}

export function createTokenForUser(
  userId: string,
  role: string,
  permissions: string[],
  workspaceId?: string
): string {
  const payload: TokenPayload = {
    userId,
    role,
    permissions,
    workspaceId,
    expires: Date.now() + TOKEN_EXPIRY,
  };
  return signPayload(payload);
}

export async function setAuthCookie(token: string): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.set(COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: TOKEN_EXPIRY / 1000,
    expires: new Date(Date.now() + TOKEN_EXPIRY),
    path: "/",
  });
}

export async function removeAuthCookie(): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.delete(COOKIE_NAME);
}

export async function getAuthToken(): Promise<string | null> {
  const cookieStore = await cookies();
  return cookieStore.get(COOKIE_NAME)?.value || null;
}

export async function getCurrentUser(): Promise<CurrentUser | null> {
  const token = await getAuthToken();
  if (!token) return null;

  const payload = verifySignedToken(token);
  if (!payload) return null;

  // Workspace member — check membership
  if (payload.workspaceId) {
    const membership = await prisma.workspaceMembership.findUnique({
      where: {
        workspaceId_userId: {
          workspaceId: payload.workspaceId,
          userId: payload.userId,
        },
      },
      select: {
        isActive: true,
        role: true,
        permissions: true,
        user: {
          select: {
            id: true,
            name: true,
            email: true,
            phone: true,
          },
        },
      },
    });

    if (!membership || !membership.isActive) return null;

    return {
      id: membership.user.id,
      name: membership.user.name,
      email: membership.user.email,
      phone: membership.user.phone,
      role: membership.role,
      permissions: membership.permissions,
      workspaceId: payload.workspaceId,
    };
  }

  // Workspace admin — check database directly
  const user = await prisma.user.findUnique({
    where: { id: payload.userId },
    select: {
      id: true,
      name: true,
      email: true,
      phone: true,
      role: true,
      permissions: true,
      isActive: true,
    },
  });

  if (!user || !user.isActive) return null;

  return {
    id: user.id,
    name: user.name,
    email: user.email,
    phone: user.phone,
    role: user.role,
    permissions: user.permissions,
  };

}

export async function requireAuth(): Promise<CurrentUser> {
  const user = await getCurrentUser();
  if (!user) {
    throw new Error("Unauthorized");
  }
  return user;
}

export function checkPermission(
  user: CurrentUser,
  permission: string,
  action: "read" | "write" = "read"
): boolean {
  if (user.role === "admin") return true;
  return hasPermission(user.permissions, permission, action);
}

export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, 12);
}

export async function verifyPassword(
  password: string,
  hash: string
): Promise<boolean> {
  return bcrypt.compare(password, hash);
}

export function generateInvitationToken(): string {
  return randomBytes(32).toString("hex");
}

export function getInvitationExpiry(): Date {
  const hours = parseInt(process.env.INVITATION_EXPIRY_HOURS || "48", 10);
  return new Date(Date.now() + hours * 60 * 60 * 1000);
}
