import { auth } from "@/lib/auth";
import { canViewAssessmentResults, getAssessmentResultsReportData } from "@/lib/assessment-detailed-results";
import { AssessmentResultsPdf } from "@/components/pdf/assessment-results-pdf";
import { renderToBuffer } from "@react-pdf/renderer";
import { NextResponse } from "next/server";
import React from "react";

export const runtime = "nodejs";

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const role = (session.user as unknown as Record<string, unknown>).role as string;
  if (role !== "PRINCIPAL") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { id: assessmentId } = await params;
  const allowed = await canViewAssessmentResults(session.user.id, role, assessmentId);
  if (!allowed) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const data = await getAssessmentResultsReportData(assessmentId);
  if (!data) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const buffer = await renderToBuffer(<AssessmentResultsPdf data={data} />);
  const safeTitle = data.assessment.title.replace(/[^\w\-]+/g, "_").slice(0, 60) || "assessment";

  return new NextResponse(new Uint8Array(buffer), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${safeTitle}-results.pdf"`,
      "Cache-Control": "no-store",
    },
  });
}
