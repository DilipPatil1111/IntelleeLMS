import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { hasTeacherPortalAccess } from "@/lib/portal-access";
import { getOrCreateInstitutionProfile } from "@/lib/institution-profile";
import {
  CertificatePdf, DEFAULT_FIELDS, isPdfUrl, generateCertificateFromPdfTemplate,
} from "@/lib/certificate-generator";
import type { CertificateField, CertificateData } from "@/lib/certificate-generator";
import { getNextCertificateNumber } from "@/lib/certificate-number";
import { sendEmailWithSignature } from "@/lib/email-signature";
import { renderToBuffer } from "@react-pdf/renderer";
import { NextResponse } from "next/server";

export const runtime = "nodejs";

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!hasTeacherPortalAccess(session)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const body = await req.json();
  const { templateId, recipientUserIds, programId, completionDate, customText } = body as {
    templateId: string;
    recipientUserIds: string[];
    programId?: string;
    completionDate?: string;
    customText?: string;
  };

  if (!templateId || !Array.isArray(recipientUserIds) || recipientUserIds.length === 0) {
    return NextResponse.json({ error: "templateId and recipientUserIds required" }, { status: 400 });
  }

  const template = await db.certificateTemplate.findUnique({ where: { id: templateId } });
  if (!template) return NextResponse.json({ error: "Template not found" }, { status: 404 });

  const fields: CertificateField[] = (() => {
    try { return JSON.parse(template.fieldsJson); } catch { return DEFAULT_FIELDS; }
  })();

  const [profile, teacher, principal] = await Promise.all([
    getOrCreateInstitutionProfile(),
    db.user.findUnique({
      where: { id: session.user.id },
      select: { firstName: true, lastName: true, signatureImageUrl: true },
    }),
    db.user.findFirst({
      where: { role: "PRINCIPAL" },
      select: { firstName: true, lastName: true, signatureImageUrl: true },
    }),
  ]);

  const principalName = principal ? `${principal.firstName} ${principal.lastName}` : (teacher ? `${teacher.firstName} ${teacher.lastName}` : "");
  const signatureUrl = principal?.signatureImageUrl || teacher?.signatureImageUrl || undefined;
  const usePdfTemplate = isPdfUrl(template.backgroundUrl, template.backgroundFileName);

  let programName = "";
  if (programId) {
    const prog = await db.program.findUnique({ where: { id: programId }, select: { name: true } });
    if (prog) programName = prog.name;
  }

  const dateStr = completionDate || new Date().toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" });
  const results: { userId: string; ok: boolean; certNumber?: string; error?: string }[] = [];

  for (const userId of recipientUserIds) {
    try {
      const user = await db.user.findUnique({
        where: { id: userId },
        select: { firstName: true, lastName: true, email: true },
      });
      if (!user) { results.push({ userId, ok: false, error: "User not found" }); continue; }

      const certNumber = await getNextCertificateNumber();

      const data: CertificateData = {
        STUDENT_NAME: `${user.firstName} ${user.lastName}`,
        PROGRAM_NAME: programName || "—",
        CERTIFICATE_NUMBER: certNumber,
        COMPLETION_DATE: dateStr,
        PRINCIPAL_NAME: principalName,
        PRINCIPAL_SIGNATURE: signatureUrl,
        INSTITUTION_NAME: profile.legalName || "Institution",
        INSTITUTION_LOGO: profile.logoUrl || undefined,
        CUSTOM_TEXT: customText || "Certificate of Completion",
      };

      let buffer: Uint8Array | Buffer;
      if (usePdfTemplate) {
        buffer = await generateCertificateFromPdfTemplate({
          pdfUrl: template.backgroundUrl!,
          orientation: template.orientation as "LANDSCAPE" | "PORTRAIT",
          pageSize: template.pageSize as "A4" | "LETTER",
          fields,
          data,
        });
      } else {
        /* eslint-disable react-hooks/error-boundaries -- server-side PDF generation, not a React component */
        buffer = await renderToBuffer(
          <CertificatePdf
            backgroundUrl={template.backgroundUrl}
            orientation={template.orientation as "LANDSCAPE" | "PORTRAIT"}
            pageSize={template.pageSize as "A4" | "LETTER"}
            fields={fields}
            data={data}
          />
        );
        /* eslint-enable react-hooks/error-boundaries */
      }

      await db.certificateIssued.create({
        data: {
          certificateNumber: certNumber,
          templateId: template.id,
          recipientId: userId,
          programId: programId || null,
          dataJson: JSON.stringify(data),
          sentAt: new Date(),
          sentByUserId: session.user.id,
        },
      });

      const emailResult = await sendEmailWithSignature({
        to: user.email,
        subject: `Certificate — ${data.CUSTOM_TEXT} — ${certNumber}`,
        html: `
          <div style="font-family:sans-serif;max-width:600px;margin:0 auto;">
            {INSTITUTION_HEADER}
            <p>Dear ${user.firstName},</p>
            <p>Please find attached your certificate <strong>${certNumber}</strong>.</p>
            ${programName ? `<p><strong>Program:</strong> ${programName}</p>` : ""}
            <p><strong>Date:</strong> ${dateStr}</p>
            <p style="color:#6b7280;font-size:13px;">Congratulations on your achievement!</p>
          </div>
        `,
        attachments: [{ filename: `Certificate-${certNumber}.pdf`, content: Buffer.from(buffer) }],
        senderUserId: session.user.id,
      });

      results.push({ userId, ok: emailResult.ok !== false, certNumber, error: emailResult.ok === false ? "Email failed" : undefined });

      await db.notification.create({
        data: {
          userId,
          type: "GENERAL",
          title: `Certificate issued: ${certNumber}`,
          message: `Your certificate for ${programName || "completion"} has been emailed to you.`,
        },
      });
    } catch (e) {
      console.error(`[cert-send] Error for user ${userId}:`, e);
      results.push({ userId, ok: false, error: e instanceof Error ? e.message : "Unknown error" });
    }
  }

  return NextResponse.json({ results });
}
