import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { hasStudentPortalAccess } from "@/lib/portal-access";
import { loadAttendanceGridData } from "@/lib/attendance-grid-server";
import { NextResponse } from "next/server";

export const runtime = "nodejs";

/** Read-only program attendance sheet for the logged-in student (single row). */
export async function GET(req: Request) {
  try {
    const session = await auth();
    if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    if (!hasStudentPortalAccess(session)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

    const { searchParams } = new URL(req.url);
    const batchId = searchParams.get("batchId");
    const subjectId = searchParams.get("subjectId");
    if (!batchId || !subjectId) return NextResponse.json({ error: "batchId and subjectId required" }, { status: 400 });

    const profile = await db.studentProfile.findUnique({
      where: { userId: session.user.id },
      select: { batchId: true },
    });
    if (!profile || profile.batchId !== batchId) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const data = await loadAttendanceGridData(batchId, subjectId);
    if (!data) return NextResponse.json({ error: "Not found" }, { status: 404 });

    const uid = session.user.id;
    if (!data.students.some((s) => s.id === uid)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const filtered = {
      ...data,
      students: data.students.filter((s) => s.id === uid),
      cells: { [uid]: data.cells[uid] ?? {} },
    };

    return NextResponse.json(JSON.parse(JSON.stringify(filtered)) as typeof filtered);
  } catch (e) {
    console.error("[student/attendance/grid GET]", e);
    const message = e instanceof Error ? e.message : "Internal error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
