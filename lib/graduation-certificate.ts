import { db } from "@/lib/db";
import { sendEmailWithSignature } from "@/lib/email-signature";
import { getOrCreateInstitutionSettings } from "@/lib/institution-settings";

/**
 * When a student is marked GRADUATED, email the certificate template (if configured in Settings)
 * and record graduationCertificateSentAt. Idempotent if already sent.
 */
export async function sendGraduationCertificateEmail(studentUserId: string): Promise<void> {
  const profile = await db.studentProfile.findUnique({
    where: { userId: studentUserId },
    include: { user: true, program: true },
  });
  if (!profile || profile.status !== "GRADUATED") return;
  if (profile.graduationCertificateSentAt) return;

  const settings = await getOrCreateInstitutionSettings();
  const firstName = profile.user.firstName;
  const programName = profile.program?.name ?? "your program";
  const enrollmentNo = profile.enrollmentNo;

  let attachment: { filename: string; content: Buffer } | undefined;
  if (settings.certificateTemplateUrl) {
    try {
      const response = await fetch(settings.certificateTemplateUrl);
      if (response.ok) {
        const buf = Buffer.from(await response.arrayBuffer());
        const fname = settings.certificateTemplateFileName || "graduation-certificate.pdf";
        attachment = { filename: fname, content: buf };
      } else {
        console.error(
          "[graduation] Certificate template fetch failed:",
          settings.certificateTemplateUrl,
          response.status
        );
      }
    } catch (e) {
      console.error("[graduation] Certificate template fetch error:", settings.certificateTemplateUrl, e);
    }
  }

  const subject = `Congratulations — Graduation certificate — ${programName}`;
  const html = `
      <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #4f46e5;">Intellee College</h2>
        <p>Dear ${escapeHtml(firstName)},</p>
        <p>Congratulations on completing all academic and compliance requirements for <strong>${escapeHtml(programName)}</strong>.</p>
        <p><strong>Enrollment:</strong> ${escapeHtml(enrollmentNo)}</p>
        ${
          attachment
            ? "<p>Your graduation certificate is attached to this email.</p>"
            : "<p>Your graduation has been recorded. If you do not see a certificate attached, the office will send it separately or upload a template under Principal → Settings → Certificate &amp; transcript templates.</p>"
        }
        <p style="color:#6b7280;font-size:13px;">Keep this email for your records.</p>
      </div>
    `;
  const text = `Dear ${firstName},\n\nCongratulations on graduating from ${programName}. Enrollment: ${enrollmentNo}.\n${
    attachment ? "Your certificate is attached.\n" : "Contact the office if you need a certificate copy.\n"
  }`;

  const result = await sendEmailWithSignature({
    to: profile.user.email,
    subject,
    html,
    text,
    attachments: attachment ? [attachment] : undefined,
    senderUserId: null, // system-generated, use generic institutional signature
  });

  if (!result.ok) {
    console.error("[graduation] Email send failed:", result.error);
    await db.notification.create({
      data: {
        userId: studentUserId,
        type: "GENERAL",
        title: "Graduated — email issue",
        message:
          "You have been marked as graduated, but the certificate email could not be sent. Please contact the office or check your email address on file.",
        link: "/student/notifications",
      },
    });
    return;
  }

  await db.studentProfile.update({
    where: { userId: studentUserId },
    data: { graduationCertificateSentAt: new Date() },
  });

  await db.notification.create({
    data: {
      userId: studentUserId,
      type: "GRADUATION_CERTIFICATE_SENT",
      title: attachment ? "Graduation certificate emailed" : "Graduation recorded",
      message: attachment
        ? "Your graduation certificate has been sent to your email address. Check your inbox (and spam folder)."
        : "You have been marked as graduated. No certificate file was attached — upload a template under Settings if email delivery should include a PDF.",
      link: "/student/notifications",
    },
  });
}

function escapeHtml(text: string): string {
  return text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}
