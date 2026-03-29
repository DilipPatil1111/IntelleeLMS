import { auth } from "@/lib/auth";
import { canViewAssessmentResults, getAssessmentResultsReportData } from "@/lib/assessment-detailed-results";
import { NextResponse } from "next/server";

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

  return NextResponse.json(data, {
    headers: { "Cache-Control": "no-store" },
  });
}
