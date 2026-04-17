import { auth } from "@/lib/auth";
import { hasStudentPortalAccess } from "@/lib/portal-access";
import { db } from "@/lib/db";
import { getTranscriptById } from "@/lib/transcript";
import { getOrCreateInstitutionProfile } from "@/lib/institution-profile";
import { TranscriptPdf } from "@/components/pdf/transcript-pdf";
import { renderToBuffer } from "@react-pdf/renderer";
import { NextResponse } from "next/server";
import React from "react";

export const runtime = "nodejs";

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!hasStudentPortalAccess(session)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const { id } = await params;

  const [transcript, bands, profile] = await Promise.all([
    getTranscriptById(id),
    db.gradeBand.findMany({ orderBy: { sortOrder: "asc" } }),
    getOrCreateInstitutionProfile(),
  ]);

  if (!transcript) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (transcript.studentId !== session.user.id || transcript.status !== "PUBLISHED") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const institution = {
    name: profile.legalName ?? null,
    address: profile.permanentAddress ?? profile.mailingAddress ?? null,
    website: profile.website ?? null,
    logoUrl: profile.logoUrl ?? null,
    phone: profile.phone ?? null,
    email: profile.email ?? null,
  };

  const rendered = await renderToBuffer(
    <TranscriptPdf transcript={transcript} bands={bands} institution={institution} />
  );
  const pdfBytes = new Uint8Array(rendered);
  const safeName = `${transcript.student.firstName}-${transcript.student.lastName}-transcript`
    .replace(/[^\w\-]+/g, "_")
    .slice(0, 60);

  return new NextResponse(
    pdfBytes.buffer.slice(
      pdfBytes.byteOffset,
      pdfBytes.byteOffset + pdfBytes.byteLength
    ) as ArrayBuffer,
    {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${safeName}.pdf"`,
        "Cache-Control": "no-store",
      },
    }
  );
}
