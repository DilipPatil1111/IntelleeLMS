import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { hasPrincipalPortalAccess } from "@/lib/portal-access";
import { getOrCreateInstitutionProfile } from "@/lib/institution-profile";
import {
  CertificatePdf, DEFAULT_FIELDS, isPdfUrl, generateCertificateFromPdfTemplate,
} from "@/lib/certificate-generator";
import type { CertificateField, CertificateData } from "@/lib/certificate-generator";
import { renderToBuffer } from "@react-pdf/renderer";
import { NextResponse } from "next/server";

export const runtime = "nodejs";

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!hasPrincipalPortalAccess(session)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  try {
    const body = await req.json();
    const { templateId, recipientUserId, programId, completionDate } = body;

    if (!templateId) return NextResponse.json({ error: "templateId required" }, { status: 400 });

    const template = await db.certificateTemplate.findUnique({ where: { id: templateId } });
    if (!template) return NextResponse.json({ error: "Template not found" }, { status: 404 });

    const fields: CertificateField[] = (() => {
      try { return JSON.parse(template.fieldsJson); } catch { return DEFAULT_FIELDS; }
    })();

    const data = await buildCertificateData({
      recipientUserId,
      programId,
      completionDate,
      sessionUserId: session.user.id,
      previewCertNumber: "INT000",
    });

    let buffer: Uint8Array | Buffer;

    if (isPdfUrl(template.backgroundUrl, template.backgroundFileName)) {
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

    return new NextResponse(new Uint8Array(buffer), {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `inline; filename="certificate-preview.pdf"`,
      },
    });
  } catch (e) {
    console.error("[cert-preview] Error:", e);
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Certificate generation failed" },
      { status: 500 },
    );
  }
}

async function buildCertificateData(params: {
  recipientUserId?: string;
  programId?: string;
  completionDate?: string;
  sessionUserId: string;
  previewCertNumber: string;
}): Promise<CertificateData> {
  const { recipientUserId, programId, completionDate, sessionUserId, previewCertNumber } = params;

  const [profile, principal] = await Promise.all([
    getOrCreateInstitutionProfile(),
    db.user.findUnique({
      where: { id: sessionUserId },
      select: { firstName: true, lastName: true, signatureImageUrl: true, signatureTypedName: true },
    }),
  ]);

  let recipientName = "Student Name";
  if (recipientUserId) {
    const user = await db.user.findUnique({
      where: { id: recipientUserId },
      select: { firstName: true, lastName: true },
    });
    if (user) recipientName = `${user.firstName} ${user.lastName}`;
  }

  let programName = "Program Name";
  if (programId) {
    const program = await db.program.findUnique({ where: { id: programId }, select: { name: true } });
    if (program) programName = program.name;
  }

  const principalName = principal ? `${principal.firstName} ${principal.lastName}` : "";

  return {
    STUDENT_NAME: recipientName,
    PROGRAM_NAME: programName,
    CERTIFICATE_NUMBER: previewCertNumber,
    COMPLETION_DATE: completionDate || new Date().toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" }),
    PRINCIPAL_NAME: principalName,
    PRINCIPAL_SIGNATURE: principal?.signatureImageUrl || undefined,
    INSTITUTION_NAME: profile.legalName || "Institution",
    INSTITUTION_LOGO: profile.logoUrl || undefined,
    CUSTOM_TEXT: "Certificate of Completion",
  };
}
