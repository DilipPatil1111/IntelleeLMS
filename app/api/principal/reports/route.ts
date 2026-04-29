import { requirePrincipalPortal } from "@/lib/api-auth";
import { getPerformanceReportData } from "@/lib/principal-performance-report";
import { NextResponse } from "next/server";

/**
 * Principal → Reports: "Performance by Assessment" data source.
 * All filtering + aggregation lives in `lib/principal-performance-report`
 * so the CSV and PDF exports stay in lockstep with what's on screen.
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

  // Preserve the legacy `{ data: [...] }` shape the client expects while
  // also returning the enriched filter metadata for callers that want it.
  return NextResponse.json({ data: data.rows, meta: data.filters });
}
