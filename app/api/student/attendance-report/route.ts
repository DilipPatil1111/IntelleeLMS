import { auth } from "@/lib/auth";
import { hasStudentPortalAccess } from "@/lib/portal-access";
import { getAttendanceReportData } from "@/lib/attendance-report";
import { NextResponse } from "next/server";

export async function GET(req: Request) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!hasStudentPortalAccess(session)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { searchParams } = new URL(req.url);
  const programId = searchParams.get("programId");
  if (!programId) return NextResponse.json({ error: "programId required" }, { status: 400 });

  const startDate = searchParams.get("startDate") || undefined;
  const endDate = searchParams.get("endDate") || undefined;

  const data = await getAttendanceReportData({
    studentUserId: session.user.id,
    programId,
    startDate,
    endDate,
  });

  if (!data) return NextResponse.json({ error: "Not found" }, { status: 404 });

  return NextResponse.json(data, { headers: { "Cache-Control": "no-store" } });
}
