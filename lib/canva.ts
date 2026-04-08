import { randomBytes, createHash } from "crypto";
import { env } from "@/lib/env";

const CANVA_AUTH_URL = "https://www.canva.com/api/oauth/authorize";
const CANVA_TOKEN_URL = "https://api.canva.com/rest/v1/oauth/token";
export const CANVA_API_BASE = "https://api.canva.com/rest/v1";

export function isCanvaConfigured(): boolean {
  return !!(env.CANVA_CLIENT_ID && env.CANVA_CLIENT_SECRET);
}

/**
 * Resolves the Canva redirect URI.
 * Prefers CANVA_REDIRECT_URI env var, falls back to building from NEXT_PUBLIC_APP_URL or the request origin.
 */
export function resolveRedirectUri(requestUrl?: string): string {
  if (env.CANVA_REDIRECT_URI) return env.CANVA_REDIRECT_URI;

  let base = env.NEXT_PUBLIC_APP_URL || "";
  if (requestUrl) {
    try {
      const u = new URL(requestUrl);
      base = u.origin;
    } catch { /* fall through */ }
  }
  if (!base.startsWith("http")) base = `https://${base}`;
  return `${base}/api/canva/callback`;
}

export function generatePKCE(): { codeVerifier: string; codeChallenge: string } {
  const codeVerifier = randomBytes(32).toString("base64url");
  const codeChallenge = createHash("sha256").update(codeVerifier).digest("base64url");
  return { codeVerifier, codeChallenge };
}

export function buildAuthorizeUrl(params: {
  codeChallenge: string;
  state: string;
  requestUrl?: string;
}): string {
  const redirectUri = resolveRedirectUri(params.requestUrl);
  const url = new URL(CANVA_AUTH_URL);
  url.searchParams.set("response_type", "code");
  url.searchParams.set("client_id", env.CANVA_CLIENT_ID!);
  url.searchParams.set("redirect_uri", redirectUri);
  url.searchParams.set("scope", "design:content:read design:content:write design:meta:read asset:read asset:write");
  url.searchParams.set("code_challenge", params.codeChallenge);
  url.searchParams.set("code_challenge_method", "S256");
  url.searchParams.set("state", params.state);
  return url.toString();
}

export async function exchangeCodeForTokens(code: string, codeVerifier: string) {
  const body = new URLSearchParams({
    grant_type: "authorization_code",
    code,
    redirect_uri: env.CANVA_REDIRECT_URI!,
    code_verifier: codeVerifier,
    client_id: env.CANVA_CLIENT_ID!,
    client_secret: env.CANVA_CLIENT_SECRET!,
  });

  const res = await fetch(CANVA_TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: body.toString(),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Canva token exchange failed (${res.status}): ${text}`);
  }

  return res.json() as Promise<{
    access_token: string;
    refresh_token: string;
    expires_in: number;
    token_type: string;
  }>;
}

export async function refreshCanvaTokens(refreshToken: string) {
  const body = new URLSearchParams({
    grant_type: "refresh_token",
    refresh_token: refreshToken,
    client_id: env.CANVA_CLIENT_ID!,
    client_secret: env.CANVA_CLIENT_SECRET!,
  });

  const res = await fetch(CANVA_TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: body.toString(),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Canva token refresh failed (${res.status}): ${text}`);
  }

  return res.json() as Promise<{
    access_token: string;
    refresh_token: string;
    expires_in: number;
    token_type: string;
  }>;
}

/**
 * Returns a valid Canva access token for the given user, refreshing if needed.
 * Returns null if the user hasn't connected Canva.
 */
export async function getValidCanvaToken(userId: string): Promise<string | null> {
  const { db } = await import("./db");

  const account = await db.canvaAccount.findUnique({ where: { userId } });
  if (!account) return null;

  const bufferMs = 5 * 60 * 1000;
  if (account.expiresAt.getTime() - bufferMs > Date.now()) {
    return account.accessToken;
  }

  try {
    const tokens = await refreshCanvaTokens(account.refreshToken);
    await db.canvaAccount.update({
      where: { userId },
      data: {
        accessToken: tokens.access_token,
        refreshToken: tokens.refresh_token,
        expiresAt: new Date(Date.now() + tokens.expires_in * 1000),
      },
    });
    return tokens.access_token;
  } catch {
    await db.canvaAccount.delete({ where: { userId } });
    return null;
  }
}

/**
 * Make an authenticated request to the Canva REST API.
 */
export async function canvaFetch(
  accessToken: string,
  path: string,
  options: RequestInit = {}
): Promise<Response> {
  return fetch(`${CANVA_API_BASE}${path}`, {
    ...options,
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
      ...options.headers,
    },
  });
}
