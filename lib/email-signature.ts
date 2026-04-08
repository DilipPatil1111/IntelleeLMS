/**
 * Email Signature helpers — server-only.
 *
 * Builds an HTML signature block appended to every outgoing email.
 *
 * Rules:
 *  - If the sending user is a PRINCIPAL / ADMINISTRATOR:
 *      • Show their uploaded signature image (if any), OR their typed name in a
 *        cursive-style span, OR their full name as a fallback.
 *      • Below the signature show the Institution Profile details
 *        (logo, name, address, phone, email, website, social links).
 *  - For any other role (TEACHER, etc.):
 *      • Show the sender's full name + role in plain text.
 *      • Show the Institution Profile details below.
 *  - If institution details are not yet filled in, only what is present is shown.
 */

import { db } from "@/lib/db";
import { escapeHtml, sendEmail } from "@/lib/email";
import type { SendEmailResult } from "@/lib/email";
import { getOrCreateInstitutionProfile } from "@/lib/institution-profile";

interface SenderInfo {
  id: string;
  firstName: string;
  lastName: string;
  role: string;
  signatureImageUrl?: string | null;
  signatureTypedName?: string | null;
}

/** Fetches the sender user record (with signature fields). Returns null when userId is empty/missing. */
export async function getSenderInfo(userId: string | null | undefined): Promise<SenderInfo | null> {
  if (!userId) return null;
  try {
    const user = await db.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        role: true,
        signatureImageUrl: true,
        signatureTypedName: true,
      },
    });
    return user ?? null;
  } catch {
    // Fallback when the DB migration hasn't been applied yet (signatureImageUrl/signatureTypedName columns don't exist)
    try {
      const user = await db.user.findUnique({
        where: { id: userId },
        select: { id: true, firstName: true, lastName: true, role: true },
      });
      if (!user) return null;
      return { ...user, signatureImageUrl: null, signatureTypedName: null };
    } catch {
      return null;
    }
  }
}

/** Builds the full-width HR separator + signature footer for HTML emails. */
export async function buildEmailSignatureHtml(userId: string | null | undefined): Promise<string> {
  const [sender, profile] = await Promise.all([
    getSenderInfo(userId),
    getOrCreateInstitutionProfile(),
  ]);

  const isPrincipal =
    sender?.role === "PRINCIPAL" || sender?.role === "ADMINISTRATOR";

  // ── Signature line ──────────────────────────────────────────────────────
  let signatureLine = "";

  if (isPrincipal) {
    if (sender.signatureImageUrl) {
      signatureLine = `<img src="${escapeHtml(sender.signatureImageUrl)}" alt="Signature" style="max-height:60px;max-width:200px;display:block;margin-bottom:4px;" />`;
    } else if (sender.signatureTypedName?.trim()) {
      signatureLine = `<span style="font-family:'Brush Script MT','Segoe Script','Comic Sans MS',cursive;font-size:22px;color:#1f2937;display:block;margin-bottom:4px;">${escapeHtml(sender.signatureTypedName.trim())}</span>`;
    } else {
      // Fallback: full name
      signatureLine = `<strong style="font-size:14px;">${escapeHtml(sender.firstName)} ${escapeHtml(sender.lastName)}</strong>`;
    }
    signatureLine += `<br><span style="font-size:12px;color:#6b7280;">Principal / Administrator</span>`;
  } else if (sender) {
    signatureLine = `<strong style="font-size:14px;">${escapeHtml(sender.firstName)} ${escapeHtml(sender.lastName)}</strong><br><span style="font-size:12px;color:#6b7280;">${escapeHtml(sender.role.charAt(0) + sender.role.slice(1).toLowerCase())}</span>`;
  }

  // ── Institution block ───────────────────────────────────────────────────
  const institutionBlock = buildInstitutionBlock(profile);

  if (!signatureLine && !institutionBlock) return "";

  return `
<div style="margin-top:32px;padding-top:16px;border-top:1px solid #e5e7eb;font-family:sans-serif;max-width:600px;">
  ${signatureLine ? `<div style="margin-bottom:12px;">${signatureLine}</div>` : ""}
  ${institutionBlock}
</div>`;
}

/**
 * Builds the institution name row: logo image (if any) inline to the left of the name.
 * Used both in the email header (top of every email) and the signature footer.
 */
function buildInstitutionBlock(profile: Awaited<ReturnType<typeof getOrCreateInstitutionProfile>>): string {
  const parts: string[] = [];
  const mode = (profile as { brandingDisplayMode?: string }).brandingDisplayMode ?? "LOGO_WITH_TEXT";

  const showLogo = profile.logoUrl && (mode === "LOGO_ONLY" || mode === "LOGO_WITH_TEXT");
  const showText = profile.legalName && (mode === "TEXT_ONLY" || mode === "LOGO_WITH_TEXT");

  const logoHtml = showLogo
    ? `<img src="${escapeHtml(profile.logoUrl!)}" alt="${escapeHtml(profile.legalName ?? "logo")}" style="height:36px;width:auto;vertical-align:middle;margin-right:8px;display:inline-block;" />`
    : "";
  const nameHtml = showText
    ? `<strong style="font-size:15px;color:#111827;vertical-align:middle;">${escapeHtml(profile.legalName!)}</strong>`
    : "";

  if (logoHtml || nameHtml) {
    parts.push(`<div style="margin-bottom:4px;line-height:1;">${logoHtml}${nameHtml}</div>`);
  }

  const addressLine = [profile.permanentAddress, profile.mailingAddress]
    .filter(Boolean)
    .join(" | ");
  if (addressLine) {
    parts.push(`<div style="font-size:12px;color:#374151;">${escapeHtml(addressLine)}</div>`);
  }

  const contactParts = [
    profile.phone ? `Tel: ${profile.phone}` : null,
    profile.email ? `Email: ${profile.email}` : null,
    profile.website
      ? `Web: <a href="${escapeHtml(profile.website)}" style="color:#4f46e5;text-decoration:none;">${escapeHtml(profile.website)}</a>`
      : null,
  ].filter(Boolean);
  if (contactParts.length) {
    parts.push(`<div style="font-size:12px;color:#374151;">${contactParts.join(" &nbsp;|&nbsp; ")}</div>`);
  }

  const socialLinks = [
    profile.socialFacebookUrl ? `<a href="${escapeHtml(profile.socialFacebookUrl)}" style="color:#4f46e5;font-size:11px;text-decoration:none;">Facebook</a>` : null,
    profile.socialLinkedInUrl ? `<a href="${escapeHtml(profile.socialLinkedInUrl)}" style="color:#4f46e5;font-size:11px;text-decoration:none;">LinkedIn</a>` : null,
    profile.socialTwitterUrl ? `<a href="${escapeHtml(profile.socialTwitterUrl)}" style="color:#4f46e5;font-size:11px;text-decoration:none;">X/Twitter</a>` : null,
    profile.socialInstagramUrl ? `<a href="${escapeHtml(profile.socialInstagramUrl)}" style="color:#4f46e5;font-size:11px;text-decoration:none;">Instagram</a>` : null,
  ].filter(Boolean);
  if (socialLinks.length) {
    parts.push(`<div style="font-size:11px;margin-top:2px;">${socialLinks.join(" &nbsp;·&nbsp; ")}</div>`);
  }

  return parts.length ? `<div style="font-family:sans-serif;">${parts.join("")}</div>` : "";
}

/**
 * Builds the branded header shown at the TOP of every outgoing email body.
 * Logo (if any) sits to the left of the institution name on the same line.
 * Call once per email and prepend it before the email body content.
 */
export async function buildEmailHeader(): Promise<string> {
  const profile = await getOrCreateInstitutionProfile();
  const institutionBlock = buildInstitutionBlock(profile);
  if (!institutionBlock) {
    // Fallback to plain text name when no profile data is set
    return `<div style="font-family:sans-serif;max-width:600px;margin-bottom:16px;"><h2 style="color:#4f46e5;margin:0;">Intellee College</h2></div>`;
  }
  return `<div style="font-family:sans-serif;max-width:600px;margin-bottom:20px;padding-bottom:12px;border-bottom:1px solid #e5e7eb;">${institutionBlock}</div>`;
}

/**
 * Convenience wrapper: builds the header + signature for `senderUserId`, then calls `sendEmail()`.
 * Use this everywhere instead of `sendEmail()` so every email automatically gets the
 * correct institution header (logo + name at top) and signature footer.
 */
export async function sendEmailWithSignature(
  params: Parameters<typeof sendEmail>[0] & { senderUserId?: string | null },
): Promise<SendEmailResult> {
  const { senderUserId, ...emailParams } = params;
  const [signatureHtml, headerHtml] = await Promise.all([
    buildEmailSignatureHtml(senderUserId),
    buildEmailHeader(),
  ]);
  return sendEmail({ ...emailParams, signatureHtml: signatureHtml || null, headerHtml });
}
