import { auth } from "@/lib/auth";
import { getOrCreateInstitutionProfile } from "@/lib/institution-profile";
import { NextResponse } from "next/server";

export const runtime = "nodejs";

/** Read-only endpoint: any authenticated user can fetch institution display info for transcripts / PDFs. */
export async function GET() {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const profile = await getOrCreateInstitutionProfile();

  return NextResponse.json({
    name: profile.legalName ?? null,
    address: profile.permanentAddress ?? profile.mailingAddress ?? null,
    website: profile.website ?? null,
    logoUrl: profile.logoUrl ?? null,
    phone: profile.phone ?? null,
    email: profile.email ?? null,
  });
}
