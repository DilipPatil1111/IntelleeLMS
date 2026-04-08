import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { getOrCreateInstitutionProfile } from "@/lib/institution-profile";
import { hasPrincipalPortalAccess } from "@/lib/portal-access";
import { NextResponse } from "next/server";

export const runtime = "nodejs";

export async function GET() {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!hasPrincipalPortalAccess(session)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const profile = await getOrCreateInstitutionProfile();
  return NextResponse.json({ profile });
}

export async function PUT(req: Request) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!hasPrincipalPortalAccess(session)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const body = await req.json();
  const p = body.profile as Record<string, unknown> | undefined;
  if (!p) return NextResponse.json({ error: "Missing profile" }, { status: 400 });

  const str = (k: string) =>
    Object.prototype.hasOwnProperty.call(p, k)
      ? typeof p[k] === "string"
        ? p[k] === ""
          ? null
          : (p[k] as string)
        : undefined
      : undefined;

  const profile = await db.institutionProfile.upsert({
    where: { id: 1 },
    create: {
      id: 1,
      institutionNumber: str("institutionNumber") ?? null,
      legalName: str("legalName") ?? null,
      permanentAddress: str("permanentAddress") ?? null,
      mailingAddress: str("mailingAddress") ?? null,
      phone: str("phone") ?? null,
      email: str("email") ?? null,
      website: str("website") ?? null,
      socialFacebookUrl: str("socialFacebookUrl") ?? null,
      socialLinkedInUrl: str("socialLinkedInUrl") ?? null,
      socialTwitterUrl: str("socialTwitterUrl") ?? null,
      socialInstagramUrl: str("socialInstagramUrl") ?? null,
      logoUrl: str("logoUrl") ?? null,
      brandColor: str("brandColor") ?? null,
      brandingDisplayMode: str("brandingDisplayMode") ?? "LOGO_WITH_TEXT",
    },
    update: {
      ...(Object.prototype.hasOwnProperty.call(p, "institutionNumber") && {
        institutionNumber: str("institutionNumber") ?? null,
      }),
      ...(Object.prototype.hasOwnProperty.call(p, "legalName") && { legalName: str("legalName") ?? null }),
      ...(Object.prototype.hasOwnProperty.call(p, "permanentAddress") && {
        permanentAddress: str("permanentAddress") ?? null,
      }),
      ...(Object.prototype.hasOwnProperty.call(p, "mailingAddress") && {
        mailingAddress: str("mailingAddress") ?? null,
      }),
      ...(Object.prototype.hasOwnProperty.call(p, "phone") && { phone: str("phone") ?? null }),
      ...(Object.prototype.hasOwnProperty.call(p, "email") && { email: str("email") ?? null }),
      ...(Object.prototype.hasOwnProperty.call(p, "website") && { website: str("website") ?? null }),
      ...(Object.prototype.hasOwnProperty.call(p, "socialFacebookUrl") && {
        socialFacebookUrl: str("socialFacebookUrl") ?? null,
      }),
      ...(Object.prototype.hasOwnProperty.call(p, "socialLinkedInUrl") && {
        socialLinkedInUrl: str("socialLinkedInUrl") ?? null,
      }),
      ...(Object.prototype.hasOwnProperty.call(p, "socialTwitterUrl") && {
        socialTwitterUrl: str("socialTwitterUrl") ?? null,
      }),
      ...(Object.prototype.hasOwnProperty.call(p, "socialInstagramUrl") && {
        socialInstagramUrl: str("socialInstagramUrl") ?? null,
      }),
      ...(Object.prototype.hasOwnProperty.call(p, "logoUrl") && { logoUrl: str("logoUrl") ?? null }),
      ...(Object.prototype.hasOwnProperty.call(p, "brandColor") && { brandColor: str("brandColor") ?? null }),
      ...(Object.prototype.hasOwnProperty.call(p, "brandingDisplayMode") && {
        brandingDisplayMode: str("brandingDisplayMode") ?? "LOGO_WITH_TEXT",
      }),
    },
  });

  return NextResponse.json({ profile });
}
