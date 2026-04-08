import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { isCanvaConfigured, generatePKCE, buildAuthorizeUrl } from "@/lib/canva";
import { randomBytes, createCipheriv, createDecipheriv } from "crypto";

const ALGO = "aes-256-gcm";

function getEncryptionKey(): Buffer {
  const secret = process.env.AUTH_SECRET || "";
  const { createHash } = require("crypto") as typeof import("crypto");
  return createHash("sha256").update(secret).digest();
}

function encryptState(data: Record<string, string>): string {
  const key = getEncryptionKey();
  const iv = randomBytes(12);
  const cipher = createCipheriv(ALGO, key, iv);
  const json = JSON.stringify(data);
  const encrypted = Buffer.concat([cipher.update(json, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return Buffer.concat([iv, tag, encrypted]).toString("base64url");
}

export function decryptState(encoded: string): Record<string, string> | null {
  try {
    const key = getEncryptionKey();
    const buf = Buffer.from(encoded, "base64url");
    const iv = buf.subarray(0, 12);
    const tag = buf.subarray(12, 28);
    const data = buf.subarray(28);
    const decipher = createDecipheriv(ALGO, key, iv);
    decipher.setAuthTag(tag);
    const decrypted = Buffer.concat([decipher.update(data), decipher.final()]);
    return JSON.parse(decrypted.toString("utf8"));
  } catch {
    return null;
  }
}

/**
 * GET /api/canva/authorize
 * Initiates Canva OAuth 2.0 + PKCE flow.
 * Encodes code_verifier, nonce, and userId into the `state` parameter
 * so the callback doesn't depend on cookies (which fail when hostname changes).
 */
export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  if (!isCanvaConfigured()) {
    return NextResponse.json(
      { error: "Canva integration is not configured. Set CANVA_CLIENT_ID, CANVA_CLIENT_SECRET, and CANVA_REDIRECT_URI." },
      { status: 503 }
    );
  }

  const { codeVerifier, codeChallenge } = generatePKCE();
  const nonce = randomBytes(16).toString("hex");

  const state = encryptState({
    nonce,
    codeVerifier,
    userId: session.user.id,
  });

  const authorizeUrl = buildAuthorizeUrl({ codeChallenge, state });

  return NextResponse.json({ url: authorizeUrl });
}
