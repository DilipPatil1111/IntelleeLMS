import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { isCanvaConfigured } from "@/lib/canva";

/**
 * GET /api/canva/status
 * Returns whether Canva is configured and whether the current user is connected.
 */
export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const configured = isCanvaConfigured();
  if (!configured) {
    return NextResponse.json({ configured: false, connected: false });
  }

  const account = await db.canvaAccount.findUnique({
    where: { userId: session.user.id },
    select: { canvaUserId: true, expiresAt: true },
  });

  return NextResponse.json({
    configured: true,
    connected: !!account,
    canvaUserId: account?.canvaUserId ?? null,
    tokenExpires: account?.expiresAt?.toISOString() ?? null,
  });
}
