import { prisma } from "./prisma";

export const GOOGLE_SCOPES = [
  "openid",
  "https://www.googleapis.com/auth/userinfo.email",
  "https://www.googleapis.com/auth/userinfo.profile",
  "https://www.googleapis.com/auth/drive.file",
  "https://www.googleapis.com/auth/drive.readonly",
  "https://www.googleapis.com/auth/calendar",
  "https://www.googleapis.com/auth/spreadsheets",
];


export function getGoogleClientId(): string {
  return process.env.GOOGLE_CLIENT_ID || "";
}

export function getGoogleClientSecret(): string {
  return process.env.GOOGLE_CLIENT_SECRET || "";
}

export function getGoogleRedirectUri(): string {
  if (process.env.GOOGLE_REDIRECT_URI) {
    return process.env.GOOGLE_REDIRECT_URI;
  }
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
  return `${baseUrl.replace(/\/$/, "")}/auth/google/callback`;
}

export function getGoogleAuthUrl(state: string = "admin", prompt: string = "select_account"): string {
  const clientId = getGoogleClientId();
  const redirectUri = getGoogleRedirectUri();

  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    response_type: "code",
    scope: GOOGLE_SCOPES.join(" "),
    access_type: "offline",
    prompt,
    include_granted_scopes: "true",
    state,
  });

  return `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`;
}

export interface GoogleTokenResponse {
  access_token: string;
  expires_in: number;
  refresh_token?: string;
  scope: string;
  token_type: string;
  id_token?: string;
}

export interface GoogleUserProfile {
  id: string;
  email: string;
  verified_email?: boolean;
  name: string;
  given_name?: string;
  family_name?: string;
  picture?: string;
  locale?: string;
}

export async function exchangeGoogleCode(code: string): Promise<GoogleTokenResponse> {
  const clientId = getGoogleClientId();
  const clientSecret = getGoogleClientSecret();
  const redirectUri = getGoogleRedirectUri();

  if (!clientId || !clientSecret) {
    throw new Error("GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET must be configured in .env");
  }

  const response = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams({
      code,
      client_id: clientId,
      client_secret: clientSecret,
      redirect_uri: redirectUri,
      grant_type: "authorization_code",
    }),
  });

  if (!response.ok) {
    const errorBody = await response.text();
    throw new Error(`Failed to exchange Google OAuth code: ${response.status} ${errorBody}`);
  }

  return response.json();
}

export async function refreshGoogleAccessToken(refreshToken: string): Promise<{
  access_token: string;
  expires_in: number;
  scope?: string;
}> {
  const clientId = getGoogleClientId();
  const clientSecret = getGoogleClientSecret();

  const response = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      refresh_token: refreshToken,
      grant_type: "refresh_token",
    }),
  });

  if (!response.ok) {
    const errorBody = await response.text();
    throw new Error(`Failed to refresh Google token: ${response.status} ${errorBody}`);
  }

  return response.json();
}

export async function getGoogleUserProfile(accessToken: string): Promise<GoogleUserProfile> {
  const response = await fetch("https://www.googleapis.com/oauth2/v2/userinfo", {
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  });

  if (!response.ok) {
    const errorBody = await response.text();
    throw new Error(`Failed to fetch Google profile: ${response.status} ${errorBody}`);
  }

  return response.json();
}

export async function getValidGoogleAccount(userId: string = "admin") {
  const account = await prisma.googleAccount.findFirst({
    where: { userId },
    orderBy: { updatedAt: "desc" },
  });

  if (!account) {
    return null;
  }

  // Check if token expired or about to expire in 5 minutes
  const isExpired =
    account.tokenExpiresAt &&
    new Date(account.tokenExpiresAt).getTime() - 5 * 60 * 1000 < Date.now();

  if (isExpired && account.refreshToken) {
    try {
      const refreshed = await refreshGoogleAccessToken(account.refreshToken);
      const newExpiresAt = new Date(Date.now() + refreshed.expires_in * 1000);

      const updated = await prisma.googleAccount.update({
        where: { id: account.id },
        data: {
          accessToken: refreshed.access_token,
          tokenExpiresAt: newExpiresAt,
          updatedAt: new Date(),
        },
      });

      return updated;
    } catch (err) {
      console.error("Failed to auto-refresh Google access token:", err);
      return account; // Return current with potential risk of 401
    }
  }

  return account;
}

export async function getWorkspaceAdminGoogleAccount(workspaceAdminId?: string) {
  if (workspaceAdminId && workspaceAdminId !== "admin") {
    // 1. Try finding by userId directly
    const userAccount = await getValidGoogleAccount(workspaceAdminId);
    if (userAccount) return userAccount;

    // 2. Check if the user exists and has a linked google account by email
    const user = await prisma.user.findUnique({
      where: { id: workspaceAdminId },
      select: { email: true },
    });
    if (user) {
      const accountByEmail = await prisma.googleAccount.findFirst({
        where: { email: user.email.toLowerCase() },
        orderBy: { updatedAt: "desc" },
      });
      if (accountByEmail) {
        if (accountByEmail.userId !== workspaceAdminId) {
          await prisma.googleAccount.update({
            where: { id: accountByEmail.id },
            data: { userId: workspaceAdminId },
          });
        }
        return accountByEmail;
      }
    }
    return null;
  }

  // Legacy fallback for legacy "admin" string only
  if (workspaceAdminId === "admin") {
    const adminAccount = await prisma.googleAccount.findFirst({
      where: { userId: "admin" },
      orderBy: { updatedAt: "desc" },
    });
    if (adminAccount) return adminAccount;
  }

  return null;
}

