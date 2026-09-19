import { prisma } from "@/lib/prisma";

export interface LogActivityParams {
  action: string;
  section: "leads" | "forms" | "credentials" | "finance" | "env" | "team" | "auth" | "settings" | string;
  details?: string | Record<string, unknown> | null;
  userEmail?: string;
  userName?: string;
  user?: { email?: string; name?: string; role?: string } | null;
  req?: Request;
}

function parseUserAgent(ua: string | null): { browser: string; os: string; device: string } {
  if (!ua) return { browser: "Unknown Browser", os: "Unknown OS", device: "Desktop" };

  let browser = "Unknown Browser";
  if (ua.includes("Edg/")) browser = "Microsoft Edge";
  else if (ua.includes("Chrome/") && !ua.includes("Chromium/")) browser = "Google Chrome";
  else if (ua.includes("Firefox/")) browser = "Mozilla Firefox";
  else if (ua.includes("Safari/") && !ua.includes("Chrome/")) browser = "Apple Safari";
  else if (ua.includes("Opera/") || ua.includes("OPR/")) browser = "Opera";
  else if (ua.includes("Brave")) browser = "Brave";

  let os = "Unknown OS";
  if (ua.includes("Windows NT 10.0")) os = "Windows 10/11";
  else if (ua.includes("Windows NT 6.3")) os = "Windows 8.1";
  else if (ua.includes("Windows NT 6.1")) os = "Windows 7";
  else if (ua.includes("Mac OS X")) os = "macOS";
  else if (ua.includes("Android")) os = "Android";
  else if (ua.includes("iPhone") || ua.includes("iPad")) os = "iOS";
  else if (ua.includes("Linux")) os = "Linux";

  let device = "Desktop";
  if (ua.includes("Mobile") || ua.includes("Android") || ua.includes("iPhone")) {
    device = "Mobile";
  } else if (ua.includes("iPad") || ua.includes("Tablet")) {
    device = "Tablet";
  }

  return { browser, os, device };
}

export async function logActivity({
  action,
  section,
  details,
  userEmail,
  userName,
  user,
  req,
}: LogActivityParams): Promise<void> {
  try {
    const finalEmail = userEmail || user?.email || "system";
    const finalName = userName || user?.name || null;

    let ipAddress: string | null = null;
    let locationStr: string | null = null;
    let clientMeta: Record<string, unknown> | null = null;

    if (req) {
      const forwarded = req.headers.get("x-forwarded-for");
      const cfIp = req.headers.get("cf-connecting-ip");
      const realIp = req.headers.get("x-real-ip");
      const trueClientIp = req.headers.get("true-client-ip");

      const rawIp = cfIp || trueClientIp || (forwarded ? forwarded.split(",")[0].trim() : realIp);
      ipAddress = rawIp || null;

      // Extract geo information from CDN headers if available
      const country = req.headers.get("cf-ipcountry") || req.headers.get("x-vercel-ip-country");
      const city = req.headers.get("cf-ipcity") || req.headers.get("x-vercel-ip-city");
      const region = req.headers.get("cf-region") || req.headers.get("x-vercel-ip-country-region");

      if (city && country) {
        locationStr = `${decodeURIComponent(city)}, ${country}`;
      } else if (country) {
        locationStr = country;
      } else if (ipAddress === "::1" || ipAddress === "127.0.0.1" || ipAddress?.startsWith("192.168.") || ipAddress?.startsWith("10.")) {
        locationStr = "Local / Internal Network";
      }

      const ua = req.headers.get("user-agent");
      const { browser, os, device } = parseUserAgent(ua);

      clientMeta = {
        browser,
        os,
        device,
        location: locationStr,
        userAgent: ua ? (ua.length > 200 ? ua.slice(0, 200) + "..." : ua) : null,
      };
    }

    let parsedDetails: Record<string, unknown> = {};
    if (typeof details === "string") {
      try {
        parsedDetails = JSON.parse(details);
      } catch {
        parsedDetails = { message: details };
      }
    } else if (details && typeof details === "object") {
      parsedDetails = { ...details };
    }

    if (clientMeta) {
      parsedDetails._client = clientMeta;
    }

    const detailsString = Object.keys(parsedDetails).length > 0 ? JSON.stringify(parsedDetails) : null;

    await prisma.activityLog.create({
      data: {
        action,
        section,
        userEmail: finalEmail,
        userName: finalName,
        details: detailsString,
        ipAddress: ipAddress || (typeof window === "undefined" ? "127.0.0.1" : null),
      },
    });
  } catch (error) {
    console.error("[logActivity error]", error);
  }
}
