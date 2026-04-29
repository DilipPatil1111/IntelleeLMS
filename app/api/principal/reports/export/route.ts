import { requirePrincipalPortal } from "@/lib/api-auth";
import {
  buildPerformanceReportCsv,
  buildPerformanceReportFilenameSlug,
  getPerformanceReportData,
} from "@/lib/principal-performance-report";
import { NextResponse } from "next/server";

/**
 * CSV export of Principal → Reports → "Performance by Assessment".
 * Honors the same filters as the on-screen table (program, batch,
 * subject, student) so what the user sees is what they download.
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

  const csv = buildPerformanceReportCsv(data);
  const slug = buildPerformanceReportFilenameSlug(data);

  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="performance-by-assessment-${slug}.csv"`,
      "Cache-Control": "no-store",
    },
  });
}
