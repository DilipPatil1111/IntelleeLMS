import { requireTeacherPortal } from "@/lib/api-auth";
import { getAttendanceReportData } from "@/lib/attendance-report";
import { NextResponse } from "next/server";

export async function GET(req: Request) {
  const gate = await requireTeacherPortal();
  if (!gate.ok) return gate.response;

  const { searchParams } = new URL(req.url);
  const studentUserId = searchParams.get("studentUserId");
  const programId = searchParams.get("programId");
  if (!studentUserId || !programId) {
    return NextResponse.json({ error: "studentUserId and programId required" }, { status: 400 });
  }

  const startDate = searchParams.get("startDate") || undefined;
  const endDate = searchParams.get("endDate") || undefined;

  const data = await getAttendanceReportData({ studentUserId, programId, startDate, endDate });
  if (!data) return NextResponse.json({ error: "Not found" }, { status: 404 });

  return NextResponse.json(data, { headers: { "Cache-Control": "no-store" } });
}
