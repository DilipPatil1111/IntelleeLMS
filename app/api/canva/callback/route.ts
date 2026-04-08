import { NextRequest, NextResponse } from "next/server";
import { exchangeCodeForTokens } from "@/lib/canva";
import { db } from "@/lib/db";
import { decryptState } from "@/app/api/canva/authorize/route";

async function getReturnPath(userId: string): Promise<string> {
  try {
    const user = await db.user.findUnique({ where: { id: userId }, select: { role: true } });
    if (user?.role === "TEACHER") return "/teacher/certificate-templates";
  } catch { /* fall through */ }
  return "/principal/shared-documents";
}

function buildRedirectUrl(path: string, params: Record<string, string>): string {
  const base = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
  const qs = new URLSearchParams(params).toString();
  return `${base}${path}?${qs}`;
}

/**
 * GET /api/canva/callback
 * Canva redirects here after the user authorizes.
 * Extracts the encrypted state (containing code_verifier & userId),
 * exchanges the auth code for tokens, and stores them.
 */
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const code = searchParams.get("code");
  const stateParam = searchParams.get("state");
  const error = searchParams.get("error");

  const fallbackPath = "/principal/shared-documents";

  if (error) {
    return NextResponse.redirect(buildRedirectUrl(fallbackPath, { canva: "error", reason: error }));
  }

  if (!code || !stateParam) {
    return NextResponse.redirect(buildRedirectUrl(fallbackPath, { canva: "error", reason: "missing_params" }));
  }

  const stateData = decryptState(stateParam);
  if (!stateData || !stateData.codeVerifier || !stateData.userId) {
    return NextResponse.redirect(buildRedirectUrl(fallbackPath, { canva: "error", reason: "invalid_state" }));
  }

  const { codeVerifier, userId } = stateData;
  const returnPath = await getReturnPath(userId);

  try {
    const tokens = await exchangeCodeForTokens(code, codeVerifier);

    await db.canvaAccount.upsert({
      where: { userId },
      create: {
        userId,
        accessToken: tokens.access_token,
        refreshToken: tokens.refresh_token,
        expiresAt: new Date(Date.now() + tokens.expires_in * 1000),
      },
      update: {
        accessToken: tokens.access_token,
        refreshToken: tokens.refresh_token,
        expiresAt: new Date(Date.now() + tokens.expires_in * 1000),
      },
    });

    return NextResponse.redirect(buildRedirectUrl(returnPath, { canva: "connected" }));
  } catch (err) {
    console.error("Canva OAuth callback error:", err);
    return NextResponse.redirect(buildRedirectUrl(returnPath, { canva: "error", reason: "token_exchange_failed" }));
  }
}
