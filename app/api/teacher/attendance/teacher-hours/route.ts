import { requireTeacherPortal } from "@/lib/api-auth";
import { db } from "@/lib/db";
import { getTeacherVisibleBatchIds } from "@/lib/teacher-visible-batches";
import { endOfLocalDay, startOfLocalDay } from "@/lib/day-boundaries";
import { NextResponse } from "next/server";

export const runtime = "nodejs";

/**
 * DELETE — remove teacher self-attendance ("hours") for a single
 * subject+batch+date cell from the Program sheet grid.  When the owning
 * AttendanceSession becomes completely empty (no student records, no
 * teacher attendance), the session is removed too.
 *
 * Body:
 *   { batchId, subjectId, ymd, teacherId? }
 *
 * If `teacherId` is omitted, only the teacher self-attendance row matching the
 * current user is removed.
 */
export async function DELETE(req: Request) {
  const gate = await requireTeacherPortal();
  if (!gate.ok) return gate.response;
  const authSession = gate.session;

  const body = (await req.json().catch(() => ({}))) as {
    batchId?: string;
    subjectId?: string;
    ymd?: string;
    teacherId?: string;
  };
  const { batchId, subjectId, ymd, teacherId } = body;
  if (!batchId || !subjectId || !ymd) {
    return NextResponse.json(
      { error: "batchId, subjectId, ymd required" },
      { status: 400 }
    );
  }

  const visible = await getTeacherVisibleBatchIds(authSession.user.id, authSession);
  if (!visible.includes(batchId)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const day = new Date(ymd + "T12:00:00");
  const from = startOfLocalDay(day);
  const to = endOfLocalDay(day);

  const sessionsOnDay = await db.attendanceSession.findMany({
    where: {
      batchId,
      subjectId,
      sessionDate: { gte: from, lte: to },
    },
    select: { id: true },
  });
  if (sessionsOnDay.length === 0) {
    return NextResponse.json({ ok: true, removed: 0 });
  }

  const sessionIds = sessionsOnDay.map((s) => s.id);
  const where = teacherId
    ? { attendanceSessionId: { in: sessionIds }, teacherUserId: teacherId }
    : { attendanceSessionId: { in: sessionIds } };
  const { count } = await db.teacherAttendance.deleteMany({ where });

  // Cleanup any session whose records AND teacher attendance are now both empty.
  for (const sid of sessionIds) {
    const [records, ta] = await Promise.all([
      db.attendanceRecord.count({ where: { attendanceSessionId: sid } }),
      db.teacherAttendance.findUnique({
        where: { attendanceSessionId: sid },
        select: { id: true },
      }),
    ]);
    if (records === 0 && !ta) {
      await db.attendanceSession
        .delete({ where: { id: sid } })
        .catch(() => {/* already gone */});
    }
  }

  return NextResponse.json({ ok: true, removed: count });
}
