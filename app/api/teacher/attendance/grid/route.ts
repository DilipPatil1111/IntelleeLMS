import { auth } from "@/lib/auth";
import { hasTeacherPortalAccess } from "@/lib/portal-access";
import { NextResponse } from "next/server";
import { loadAttendanceGridData, saveAttendanceGridCells } from "@/lib/attendance-grid-server";
import { evaluateLowAttendanceForStudents } from "@/lib/attendance-threshold";

export const runtime = "nodejs";

/**
 * Teacher grid: subject+batch come from /api/teacher/options (assigned programs/subjects/batches).
 */
export async function GET(req: Request) {
  try {
    const session = await auth();
    if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    if (!hasTeacherPortalAccess(session)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

    const { searchParams } = new URL(req.url);
    const batchId = searchParams.get("batchId");
    const subjectId = searchParams.get("subjectId");
    if (!batchId || !subjectId) return NextResponse.json({ error: "batchId and subjectId required" }, { status: 400 });

    const data = await loadAttendanceGridData(batchId, subjectId);
    if (!data) return NextResponse.json({ error: "Not found" }, { status: 404 });

    return NextResponse.json(JSON.parse(JSON.stringify(data)) as typeof data);
  } catch (e) {
    console.error("[teacher/attendance/grid GET]", e);
    const message = e instanceof Error ? e.message : "Internal error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const session = await auth();
    if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    if (!hasTeacherPortalAccess(session)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

    const body = await req.json().catch(() => ({}));
    const { batchId, subjectId, changes, defaultStartTime, defaultEndTime, teacherId } = body as {
      batchId?: string;
      subjectId?: string;
      changes?: { date: string; studentId: string; letter: string }[];
      defaultStartTime?: string;
      defaultEndTime?: string;
      teacherId?: string;
    };
    if (!batchId || !subjectId || !Array.isArray(changes)) {
      return NextResponse.json({ error: "batchId, subjectId, changes[] required" }, { status: 400 });
    }

    const { updatedStudents } = await saveAttendanceGridCells({
      batchId,
      subjectId,
      createdById: session.user.id,
      changes,
      autoMarkTeacherId: teacherId || session.user.id,
      defaultStartTime: defaultStartTime || undefined,
      defaultEndTime: defaultEndTime || undefined,
    });

    await evaluateLowAttendanceForStudents(batchId, updatedStudents);

    return NextResponse.json({ ok: true, updatedStudents });
  } catch (e) {
    console.error("[teacher/attendance/grid POST]", e);
    const message = e instanceof Error ? e.message : "Internal error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
