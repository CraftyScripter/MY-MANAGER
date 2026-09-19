import { promises as dns } from "dns";

export interface MxRecord {
  exchange: string;
  priority: number;
}

export type EmailVerificationStatus =
  | "valid"
  | "valid_fallback_a"
  | "invalid_format"
  | "invalid_domain"
  | "null_mx"
  | "disposable"
  | "unreachable";

export interface EmailVerificationResult {
  valid: boolean;
  email: string;
  user: string;
  domain: string;
  status: EmailVerificationStatus;
  reason?: string;
  hasMx: boolean;
  hasARecord: boolean;
  isDisposable: boolean;
  primaryMx?: string;
  mxRecords: MxRecord[];
  checkedAt: string;
}

// Common disposable/throwaway email providers list
const DISPOSABLE_DOMAINS = new Set([
  "mailinator.com",
  "guerrillamail.com",
  "guerrillamail.info",
  "guerrillamail.biz",
  "guerrillamail.de",
  "guerrillamail.net",
  "guerrillamail.org",
  "tempmail.com",
  "temp-mail.org",
  "10minutemail.com",
  "10minutemail.net",
  "throwawaymail.com",
  "trashmail.com",
  "trashmail.net",
  "sharklasers.com",
  "grr.la",
  "yopmail.com",
  "yopmail.fr",
  "yopmail.net",
  "dispostable.com",
  "getairmail.com",
  "burnermail.io",
  "mytemp.email",
  "fakemailgenerator.com",
  "maildrop.cc",
  "inboxkitten.com",
  "mohmal.com",
  "crazymailing.com",
  "nada.ltd",
  "getnada.com",
  "emailondeck.com",
]);

// In-memory DNS cache to avoid redundant lookups (15-minute TTL)
interface CacheEntry {
  result: EmailVerificationResult;
  expiresAt: number;
}
const dnsCache = new Map<string, CacheEntry>();
const CACHE_TTL_MS = 15 * 60 * 1000;

// Strict standard RFC-compliant email regex
const EMAIL_REGEX =
  /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)+$/;

/**
 * Validates the basic structural format of an email address.
 */
export function validateEmailFormat(email: string): { valid: boolean; user: string; domain: string; error?: string } {
  if (!email || typeof email !== "string") {
    return { valid: false, user: "", domain: "", error: "Email address is required" };
  }

  const trimmed = email.trim();
  if (trimmed.length > 254) {
    return { valid: false, user: "", domain: "", error: "Email address exceeds maximum length of 254 characters" };
  }

  if (!EMAIL_REGEX.test(trimmed)) {
    return { valid: false, user: "", domain: "", error: "Invalid email address format" };
  }

  const [user, ...domainParts] = trimmed.split("@");
  const domain = domainParts.join("@").toLowerCase();

  if (user.length > 64) {
    return { valid: false, user, domain, error: "Email username portion exceeds 64 characters" };
  }

  if (user.startsWith(".") || user.endsWith(".") || user.includes("..")) {
    return { valid: false, user, domain, error: "Email contains consecutive or leading/trailing periods" };
  }

  if (!domain.includes(".")) {
    return { valid: false, user, domain, error: "Email domain must contain a valid top-level domain (TLD)" };
  }

  const tld = domain.split(".").pop();
  if (!tld || tld.length < 2) {
    return { valid: false, user, domain, error: "Email domain top-level domain is invalid" };
  }

  return { valid: true, user, domain };
}

/**
 * Wraps an async promise with a timeout in milliseconds.
 */
function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      const err = new Error(`DNS lookup timed out after ${ms}ms`);
      (err as any).code = "ETIMEOUT";
      reject(err);
    }, ms);

    promise
      .then((res) => {
        clearTimeout(timer);
        resolve(res);
      })
      .catch((err) => {
        clearTimeout(timer);
        reject(err);
      });
  });
}

export interface VerifyEmailOptions {
  /** Timeout for DNS operations in milliseconds (default: 4000ms) */
  timeoutMs?: number;
  /** Allow RFC 5321 fallback to A/AAAA records if domain has no MX (default: true) */
  allowNoMxFallback?: boolean;
  /** Reject disposable email domains (default: false) */
  blockDisposable?: boolean;
}

/**
 * Verifies if an email address exists and can accept mail using DNS verification.
 * 1. Checks RFC-compliant email syntax.
 * 2. Checks disposable email provider list.
 * 3. Queries DNS MX (Mail Exchange) records.
 * 4. Detects RFC 7505 Null MX records (domains that explicitly reject email).
 * 5. Falls back to DNS A records if permitted by RFC 5321.
 */
export async function verifyEmailDns(
  email: string,
  options: VerifyEmailOptions = {}
): Promise<EmailVerificationResult> {
  const { timeoutMs = 4000, allowNoMxFallback = true, blockDisposable = false } = options;
  const now = new Date().toISOString();

  // 1. Validate format
  const formatCheck = validateEmailFormat(email);
  if (!formatCheck.valid) {
    return {
      valid: false,
      email: email || "",
      user: formatCheck.user,
      domain: formatCheck.domain,
      status: "invalid_format",
      reason: formatCheck.error || "Invalid email format",
      hasMx: false,
      hasARecord: false,
      isDisposable: false,
      mxRecords: [],
      checkedAt: now,
    };
  }

  const normalizedEmail = `${formatCheck.user}@${formatCheck.domain}`.toLowerCase();
  const domain = formatCheck.domain;

  // 2. Check cache
  const cached = dnsCache.get(domain);
  if (cached && cached.expiresAt > Date.now()) {
    return {
      ...cached.result,
      email: normalizedEmail,
      user: formatCheck.user,
      checkedAt: now,
    };
  }

  // 3. Check disposable domain
  const isDisposable = DISPOSABLE_DOMAINS.has(domain);
  if (isDisposable && blockDisposable) {
    const result: EmailVerificationResult = {
      valid: false,
      email: normalizedEmail,
      user: formatCheck.user,
      domain,
      status: "disposable",
      reason: `Domain ${domain} is a temporary disposable email service`,
      hasMx: false,
      hasARecord: false,
      isDisposable: true,
      mxRecords: [],
      checkedAt: now,
    };
    return result;
  }

  // 4. Perform DNS MX Record Resolution
  try {
    const mxList = await withTimeout(dns.resolveMx(domain), timeoutMs);

    if (Array.isArray(mxList) && mxList.length > 0) {
      // Sort by priority ascending (lowest number = highest priority)
      const sortedMx: MxRecord[] = mxList
        .map((record) => ({
          exchange: (record.exchange || "").trim().toLowerCase(),
          priority: typeof record.priority === "number" ? record.priority : 0,
        }))
        .sort((a, b) => a.priority - b.priority);

      // Check for Null MX record (RFC 7505: exchange is "." or empty, declaring no email acceptance)
      const isNullMx = sortedMx.some(
        (rec) => rec.exchange === "." || rec.exchange === "" || rec.exchange === "0.0.0.0"
      );

      if (isNullMx) {
        const result: EmailVerificationResult = {
          valid: false,
          email: normalizedEmail,
          user: formatCheck.user,
          domain,
          status: "null_mx",
          reason: `Domain ${domain} publishes a Null MX record declaring it does not receive email (RFC 7505)`,
          hasMx: true,
          hasARecord: false,
          isDisposable,
          mxRecords: sortedMx,
          checkedAt: now,
        };
        dnsCache.set(domain, { result, expiresAt: Date.now() + CACHE_TTL_MS });
        return result;
      }

      // Valid MX records found
      const primaryMx = sortedMx[0].exchange;
      const result: EmailVerificationResult = {
        valid: true,
        email: normalizedEmail,
        user: formatCheck.user,
        domain,
        status: "valid",
        hasMx: true,
        hasARecord: false,
        isDisposable,
        primaryMx,
        mxRecords: sortedMx,
        checkedAt: now,
      };

      dnsCache.set(domain, { result, expiresAt: Date.now() + CACHE_TTL_MS });
      return result;
    }
  } catch (error: any) {
    const errorCode = error?.code;

    // If timeout or servfail, treat as unreachable
    if (errorCode === "ETIMEOUT" || errorCode === "ESERVFAIL") {
      return {
        valid: false,
        email: normalizedEmail,
        user: formatCheck.user,
        domain,
        status: "unreachable",
        reason: `DNS lookup for ${domain} timed out or mail server was unreachable`,
        hasMx: false,
        hasARecord: false,
        isDisposable,
        mxRecords: [],
        checkedAt: now,
      };
    }

    // ENOTFOUND means domain does not exist in DNS (NXDOMAIN)
    if (errorCode === "ENOTFOUND") {
      const result: EmailVerificationResult = {
        valid: false,
        email: normalizedEmail,
        user: formatCheck.user,
        domain,
        status: "invalid_domain",
        reason: `Domain "${domain}" does not exist in DNS (NXDOMAIN)`,
        hasMx: false,
        hasARecord: false,
        isDisposable,
        mxRecords: [],
        checkedAt: now,
      };
      dnsCache.set(domain, { result, expiresAt: Date.now() + CACHE_TTL_MS });
      return result;
    }

    // ENODATA means domain exists, but has no MX records. Fall back to checking A records per RFC 5321.
  }

  // 5. Fallback: Check A / AAAA record if allowed
  if (allowNoMxFallback) {
    try {
      const aRecords = await withTimeout(dns.resolve4(domain), timeoutMs);
      if (Array.isArray(aRecords) && aRecords.length > 0) {
        const result: EmailVerificationResult = {
          valid: true,
          email: normalizedEmail,
          user: formatCheck.user,
          domain,
          status: "valid_fallback_a",
          reason: `Domain has no dedicated MX records, but has valid A records (${aRecords[0]}) to accept email (RFC 5321)`,
          hasMx: false,
          hasARecord: true,
          isDisposable,
          primaryMx: aRecords[0],
          mxRecords: [],
          checkedAt: now,
        };
        dnsCache.set(domain, { result, expiresAt: Date.now() + CACHE_TTL_MS });
        return result;
      }
    } catch {
      // No A record found either
    }
  }

  // Domain exists or failed with no MX and no A records -> invalid
  const finalResult: EmailVerificationResult = {
    valid: false,
    email: normalizedEmail,
    user: formatCheck.user,
    domain,
    status: "invalid_domain",
    reason: `Domain "${domain}" does not have any active Mail Exchange (MX) records configured`,
    hasMx: false,
    hasARecord: false,
    isDisposable,
    mxRecords: [],
    checkedAt: now,
  };

  dnsCache.set(domain, { result: finalResult, expiresAt: Date.now() + CACHE_TTL_MS });
  return finalResult;
}
