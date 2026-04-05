import { db } from "@/lib/db";
import { sendEmailWithSignature } from "@/lib/email-signature";
import { getOrCreateInstitutionSettings } from "@/lib/institution-settings";
import { isProgramContentCompleteForStudent } from "@/lib/program-content";

function escapeHtml(text: string): string {
  return text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

/**
 * Send program completion certificate PDF by email. Idempotent per program+student if already sent.
 */
export async function sendProgramContentCertificateEmail(params: {
  programId: string;
  studentUserId: string;
  sentByUserId: string;
  forceResend?: boolean;
}): Promise<{ ok: true } | { ok: false; error: string; code?: "ALREADY_SENT" | "NOT_ELIGIBLE" }> {
  const { programId, studentUserId, sentByUserId, forceResend } = params;

  const existing = await db.programCertificateSend.findUnique({
    where: {
      programId_studentUserId: { programId, studentUserId },
    },
  });
  if (existing && !forceResend) {
    return { ok: false, error: "Certificate already sent for this program.", code: "ALREADY_SENT" };
  }

  const eligible = await isProgramContentCompleteForStudent(studentUserId, programId);
  if (!eligible) {
    return { ok: false, error: "Student has not completed all program content requirements.", code: "NOT_ELIGIBLE" };
  }

  const profile = await db.studentProfile.findUnique({
    where: { userId: studentUserId },
    include: { user: true, program: true },
  });
  if (!profile?.programId || profile.programId !== programId) {
    return { ok: false, error: "Student is not enrolled in this program." };
  }

  const program = await db.program.findUnique({ where: { id: programId } });
  if (!program) return { ok: false, error: "Program not found." };

  const settings = await getOrCreateInstitutionSettings();
  const firstName = profile.user.firstName;
  const programName = program.name;
  const enrollmentNo = profile.enrollmentNo;

  let attachment: { filename: string; content: Buffer } | undefined;
  if (settings.certificateTemplateUrl) {
    try {
      const response = await fetch(settings.certificateTemplateUrl);
      if (response.ok) {
        const buf = Buffer.from(await response.arrayBuffer());
        const fname = settings.certificateTemplateFileName || "program-certificate.pdf";
        attachment = { filename: fname, content: buf };
      }
    } catch (e) {
      console.error("[program-cert] template fetch error:", e);
    }
  }

  const subject = `Congratulations — ${programName} — Certificate`;
  const html = `
      <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto;">
        {INSTITUTION_HEADER}
        <p>Dear ${escapeHtml(firstName)},</p>
        <p><strong>Congratulations!</strong> You have successfully completed all requirements for <strong>${escapeHtml(programName)}</strong>.</p>
        <p><strong>Enrollment:</strong> ${escapeHtml(enrollmentNo)}</p>
        ${
          attachment
            ? "<p>Your certificate is attached to this email as a PDF.</p>"
            : "<p>Your completion is recorded. Upload a certificate template under Principal → Settings if a PDF should be attached.</p>"
        }
        <p style="color:#6b7280;font-size:13px;">We are proud of your achievement.</p>
      </div>
    `;
  const text = `Dear ${firstName},\n\nCongratulations on completing ${programName}. Enrollment: ${enrollmentNo}.\n${
    attachment ? "Your certificate is attached (PDF).\n" : ""
  }`;

  const result = await sendEmailWithSignature({
    to: profile.user.email,
    subject,
    html,
    text,
    attachments: attachment ? [attachment] : undefined,
    senderUserId: sentByUserId,
  });

  if (!result.ok) {
    return { ok: false, error: result.error || "Email send failed" };
  }

  if (existing && forceResend) {
    await db.programCertificateSend.update({
      where: { id: existing.id },
      data: { sentAt: new Date(), sentByUserId },
    });
  } else {
    await db.programCertificateSend.create({
      data: {
        programId,
        studentUserId,
        sentByUserId,
      },
    });
  }

  await db.notification.create({
    data: {
      userId: studentUserId,
      type: "GENERAL",
      title: "Program certificate emailed",
      message: `Your certificate for ${programName} has been sent to your email.`,
      link: "/student/program-content",
    },
  });

  return { ok: true };
}
