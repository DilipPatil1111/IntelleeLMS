import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { hasTeacherPortalAccess } from "@/lib/portal-access";
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
  if (!hasTeacherPortalAccess(session)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  try {
    const body = await req.json();
    const { templateId, recipientUserId, programId, completionDate } = body;

    if (!templateId) return NextResponse.json({ error: "templateId required" }, { status: 400 });

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

    let recipientName = "Student Name";
    if (recipientUserId) {
      const user = await db.user.findUnique({ where: { id: recipientUserId }, select: { firstName: true, lastName: true } });
      if (user) recipientName = `${user.firstName} ${user.lastName}`;
    }

    let programName = "Program Name";
    if (programId) {
      const prog = await db.program.findUnique({ where: { id: programId }, select: { name: true } });
      if (prog) programName = prog.name;
    }

    const data: CertificateData = {
      STUDENT_NAME: recipientName,
      PROGRAM_NAME: programName,
      CERTIFICATE_NUMBER: "INT000",
      COMPLETION_DATE: completionDate || new Date().toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" }),
      PRINCIPAL_NAME: principal ? `${principal.firstName} ${principal.lastName}` : (teacher ? `${teacher.firstName} ${teacher.lastName}` : ""),
      PRINCIPAL_SIGNATURE: principal?.signatureImageUrl || teacher?.signatureImageUrl || undefined,
      INSTITUTION_NAME: profile.legalName || "Institution",
      INSTITUTION_LOGO: profile.logoUrl || undefined,
      CUSTOM_TEXT: "Certificate of Completion",
    };

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
      buffer = await renderToBuffer(
        <CertificatePdf
          backgroundUrl={template.backgroundUrl}
          orientation={template.orientation as "LANDSCAPE" | "PORTRAIT"}
          pageSize={template.pageSize as "A4" | "LETTER"}
          fields={fields}
          data={data}
        />
      );
    }

    return new NextResponse(new Uint8Array(buffer), {
      status: 200,
      headers: { "Content-Type": "application/pdf", "Content-Disposition": `inline; filename="certificate-preview.pdf"` },
    });
  } catch (e) {
    console.error("[cert-preview] Error:", e);
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Certificate generation failed" },
      { status: 500 },
    );
  }
}
