import { auth } from "@/lib/auth";
import { getOrCreateInstitutionProfile } from "@/lib/institution-profile";
import { transcriptInstitutionFromProfile } from "@/lib/transcript-institution";
import { NextResponse } from "next/server";

export const runtime = "nodejs";

/** Read-only endpoint: any authenticated user can fetch institution display info for transcripts / PDFs. */
export async function GET() {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const profile = await getOrCreateInstitutionProfile();

  return NextResponse.json(transcriptInstitutionFromProfile(profile));
}
