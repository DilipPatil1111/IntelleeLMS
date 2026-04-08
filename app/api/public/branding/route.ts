import { db } from "@/lib/db";
import { NextResponse } from "next/server";

export const runtime = "nodejs";

export async function GET() {
  const profile = await db.institutionProfile.findUnique({
    where: { id: 1 },
    select: { logoUrl: true, legalName: true, brandColor: true, brandingDisplayMode: true },
  });

  return NextResponse.json({
    logoUrl: profile?.logoUrl ?? null,
    legalName: profile?.legalName ?? null,
    brandColor: profile?.brandColor ?? null,
    brandingDisplayMode: profile?.brandingDisplayMode ?? "LOGO_WITH_TEXT",
  });
}
