import { requirePrincipalPortal } from "@/lib/api-auth";
import { PerformanceReportPdf } from "@/components/pdf/performance-report-pdf";
import {
  buildPerformanceReportFilenameSlug,
  getPerformanceReportData,
} from "@/lib/principal-performance-report";
import { renderToBuffer } from "@react-pdf/renderer";
import { NextResponse } from "next/server";
import React from "react";

// @react-pdf/renderer uses Node APIs that aren't available on the Edge
// runtime. Pin this route to Node.
export const runtime = "nodejs";

/**
 * PDF export of Principal → Reports → "Performance by Assessment".
 * Honors the same filters as the table so the downloaded PDF matches
 * exactly what the user is looking at.
 */
export async function GET(req: Request) {
  const gate = await requirePrincipalPortal();
  if (!gate.ok) return gate.response;

  const { searchParams } = new URL(req.url);
  const data = await getPerformanceReportData({
    programId: searchParams.get("programId") || undefined,
    batchId: searchParams.get("batchId") || undefined,
    subjectId: searchParams.get("subjectId") || undefined,
    studentId: searchParams.get("studentId") || undefined,
  });

  const rendered = await renderToBuffer(<PerformanceReportPdf data={data} />);
  const pdfBytes = new Uint8Array(rendered);
  const slug = buildPerformanceReportFilenameSlug(data);

  return new NextResponse(
    pdfBytes.buffer.slice(
      pdfBytes.byteOffset,
      pdfBytes.byteOffset + pdfBytes.byteLength
    ) as ArrayBuffer,
    {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="performance-by-assessment-${slug}.pdf"`,
        "Cache-Control": "no-store",
      },
    }
  );
}
