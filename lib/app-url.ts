/**
 * Base URL for server-generated links (emails, etc.).
 * On Vercel, set NEXT_PUBLIC_APP_URL to your canonical URL (with or without https://),
 * or rely on VERCEL_URL.
 */

function readEnvTrimmed(key: string): string | undefined {
  const v = process.env[key];
  if (typeof v !== "string") return undefined;
  let s = v.trim().replace(/\r?\n/g, "");
  if ((s.startsWith('"') && s.endsWith('"')) || (s.startsWith("'") && s.endsWith("'"))) {
    s = s.slice(1, -1).trim();
  }
  return s || undefined;
}

function isLocalhost(hostname: string): boolean {
  return hostname === "localhost" || hostname === "127.0.0.1";
}

/**
 * Ensures an absolute http(s) URL suitable for email and redirects.
 * Host-only values (e.g. myapp.vercel.app) get https:// — missing scheme breaks Gmail links.
 */
export function normalizePublicBaseUrl(raw: string): string {
  let s = raw.trim().replace(/\r?\n/g, "");
  if (!/^https?:\/\//i.test(s)) {
    if (/^(localhost|127\.0\.0\.1)(:|\/|$)/i.test(s)) {
      s = `http://${s}`;
    } else {
      s = `https://${s}`;
    }
  }
  let u: URL;
  try {
    u = new URL(s);
  } catch {
    return raw.trim();
  }
  if (u.protocol !== "http:" && u.protocol !== "https:") {
    return `https://${u.host}${u.pathname}${u.search}`;
  }
  if (!isLocalhost(u.hostname) && u.protocol === "http:") {
    u.protocol = "https:";
  }
  let href = u.href;
  if (href.endsWith("/") && u.pathname === "/") {
    href = href.slice(0, -1);
  }
  return href;
}

export function getServerAppUrl(): string {
  const explicit = readEnvTrimmed("NEXT_PUBLIC_APP_URL");
  if (explicit) {
    return normalizePublicBaseUrl(explicit);
  }
  const vercel = readEnvTrimmed("VERCEL_URL");
  if (vercel) {
    const host = vercel.replace(/^https?:\/\//i, "").split("/")[0]?.trim();
    if (host) {
      return normalizePublicBaseUrl(host);
    }
  }
  return "http://localhost:3000";
}

/** Canonical login URL for emails (absolute https://…/login). */
export function getLoginPageUrl(): string {
  const base = getServerAppUrl().replace(/\/$/, "");
  return `${base}/login`;
}
