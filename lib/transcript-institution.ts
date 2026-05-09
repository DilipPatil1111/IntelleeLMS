/**
 * Official transcript / letterhead defaults when Institution Profile fields
 * are empty — matches Intellee College stationery.
 */
export const TRANSCRIPT_BRANDING_DEFAULTS = {
  name: "inTellee College",
  address: "Unit #215 1515 Matheson Blvd East,\nMississauga, ON, Canada, L4W 2P5",
  phone: "+1 647-741-0309",
  email: "programs@intelleecollege.com",
  website: "www.intelleecollege.com",
} as const;

export type TranscriptInstitutionBranding = {
  name: string;
  address: string;
  phone: string;
  email: string;
  website: string;
  logoUrl: string | null;
};

type ProfileLike = {
  legalName?: string | null;
  permanentAddress?: string | null;
  mailingAddress?: string | null;
  phone?: string | null;
  email?: string | null;
  website?: string | null;
  logoUrl?: string | null;
};

/** Merge DB institution profile with official defaults for transcripts & previews. */
export function transcriptInstitutionFromProfile(profile: ProfileLike): TranscriptInstitutionBranding {
  const d = TRANSCRIPT_BRANDING_DEFAULTS;
  const addr = profile.permanentAddress?.trim() || profile.mailingAddress?.trim() || d.address;
  return {
    name: profile.legalName?.trim() || d.name,
    address: addr,
    phone: profile.phone?.trim() || d.phone,
    email: profile.email?.trim() || d.email,
    website: profile.website?.trim() || d.website,
    logoUrl: profile.logoUrl ?? null,
  };
}
