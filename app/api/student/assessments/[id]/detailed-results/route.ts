import { auth } from "@/lib/auth";
import {
  canStudentViewOwnAssessmentResults,
  getAssessmentResultsReportData,
} from "@/lib/assessment-detailed-results";
import { hasStudentPortalAccess } from "@/lib/portal-access";
import { NextResponse } from "next/server";

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  if (!hasStudentPortalAccess(session)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { id: assessmentId } = await params;
  const allowed = await canStudentViewOwnAssessmentResults(session.user.id, assessmentId);
  if (!allowed) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const data = await getAssessmentResultsReportData(assessmentId, { forStudentId: session.user.id });
  if (!data) return NextResponse.json({ error: "Not found" }, { status: 404 });

  return NextResponse.json(data, {
    headers: { "Cache-Control": "no-store" },
  });
}
