import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";

/**
 * POST /api/canva/disconnect
 * Removes the Canva OAuth tokens for the current user.
 */
export async function POST() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  await db.canvaAccount.deleteMany({ where: { userId: session.user.id } });

  return NextResponse.json({ disconnected: true });
}
