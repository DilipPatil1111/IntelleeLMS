import { canViewAssessmentResults, getAssessmentResultsReportData } from "@/lib/assessment-detailed-results";
import { requireTeacherPortal } from "@/lib/api-auth";
import { NextResponse } from "next/server";

export const runtime = "nodejs";

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const gate = await requireTeacherPortal();
  if (!gate.ok) return gate.response;
  const session = gate.session;

  const { id: assessmentId } = await params;
  const allowed = await canViewAssessmentResults(session.user.id, session, assessmentId);
  if (!allowed) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const data = await getAssessmentResultsReportData(assessmentId);
  if (!data) return NextResponse.json({ error: "Not found" }, { status: 404 });

  return NextResponse.json(data, {
    headers: { "Cache-Control": "no-store" },
  });
}
