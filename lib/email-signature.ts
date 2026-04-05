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
  const instParts: string[] = [];

  if (profile.logoUrl) {
    instParts.push(
      `<img src="${escapeHtml(profile.logoUrl)}" alt="${escapeHtml(profile.legalName ?? "Institution logo")}" style="max-height:48px;max-width:160px;display:block;margin-bottom:6px;" />`,
    );
  }

  if (profile.legalName) {
    instParts.push(`<strong style="font-size:13px;color:#111827;">${escapeHtml(profile.legalName)}</strong>`);
  }

  const addressLine = [profile.permanentAddress, profile.mailingAddress]
    .filter(Boolean)
    .join(" | ");
  if (addressLine) {
    instParts.push(`<span style="font-size:12px;color:#374151;">${escapeHtml(addressLine)}</span>`);
  }

  const contactParts = [
    profile.phone ? `Tel: ${profile.phone}` : null,
    profile.email ? `Email: ${profile.email}` : null,
    profile.website ? `Web: ${profile.website}` : null,
  ].filter(Boolean);
  if (contactParts.length) {
    instParts.push(`<span style="font-size:12px;color:#374151;">${contactParts.map(escapeHtml).join(" &nbsp;|&nbsp; ")}</span>`);
  }

  const socialLinks = [
    profile.socialFacebookUrl ? `<a href="${escapeHtml(profile.socialFacebookUrl)}" style="color:#4f46e5;font-size:11px;text-decoration:none;">Facebook</a>` : null,
    profile.socialLinkedInUrl ? `<a href="${escapeHtml(profile.socialLinkedInUrl)}" style="color:#4f46e5;font-size:11px;text-decoration:none;">LinkedIn</a>` : null,
    profile.socialTwitterUrl ? `<a href="${escapeHtml(profile.socialTwitterUrl)}" style="color:#4f46e5;font-size:11px;text-decoration:none;">X/Twitter</a>` : null,
    profile.socialInstagramUrl ? `<a href="${escapeHtml(profile.socialInstagramUrl)}" style="color:#4f46e5;font-size:11px;text-decoration:none;">Instagram</a>` : null,
  ].filter(Boolean);
  if (socialLinks.length) {
    instParts.push(socialLinks.join(" &nbsp;·&nbsp; "));
  }

  const institutionBlock = instParts.length
    ? `<div style="margin-top:8px;">${instParts.join("<br>")}</div>`
    : "";

  if (!signatureLine && !institutionBlock) return "";

  return `
<div style="margin-top:32px;padding-top:16px;border-top:1px solid #e5e7eb;font-family:sans-serif;max-width:600px;">
  ${signatureLine ? `<div style="margin-bottom:12px;">${signatureLine}</div>` : ""}
  ${institutionBlock}
</div>`;
}

/**
 * Convenience wrapper: builds the signature for `senderUserId`, then calls `sendEmail()`.
 * Use this everywhere instead of `sendEmail()` so every email automatically gets the
 * correct signature (principal custom sig or generic institutional footer).
 */
export async function sendEmailWithSignature(
  params: Parameters<typeof sendEmail>[0] & { senderUserId?: string | null },
): Promise<SendEmailResult> {
  const { senderUserId, ...emailParams } = params;
  const signatureHtml = await buildEmailSignatureHtml(senderUserId);
  return sendEmail({ ...emailParams, signatureHtml: signatureHtml || null });
}
