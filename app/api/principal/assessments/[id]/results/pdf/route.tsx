import { canViewAssessmentResults, getAssessmentResultsReportData } from "@/lib/assessment-detailed-results";
import { requirePrincipalPortal } from "@/lib/api-auth";
import { AssessmentResultsPdf } from "@/components/pdf/assessment-results-pdf";
import { renderToBuffer } from "@react-pdf/renderer";
import { NextResponse } from "next/server";
import React from "react";

export const runtime = "nodejs";

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const gate = await requirePrincipalPortal();
  if (!gate.ok) return gate.response;
  const session = gate.session;

  const { id: assessmentId } = await params;
  const allowed = await canViewAssessmentResults(session.user.id, session, assessmentId);
  if (!allowed) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const data = await getAssessmentResultsReportData(assessmentId);
  if (!data) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const rendered = await renderToBuffer(<AssessmentResultsPdf data={data} />);
  const pdfBytes = new Uint8Array(rendered);
  const safeTitle = data.assessment.title.replace(/[^\w\-]+/g, "_").slice(0, 60) || "assessment";

  return new NextResponse(pdfBytes.buffer.slice(pdfBytes.byteOffset, pdfBytes.byteOffset + pdfBytes.byteLength) as ArrayBuffer, {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${safeTitle}-results.pdf"`,
      "Cache-Control": "no-store",
    },
  });
}
