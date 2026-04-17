import { requirePrincipalPortal } from "@/lib/api-auth";
import { db } from "@/lib/db";
import { endOfLocalDay, startOfLocalDay } from "@/lib/day-boundaries";
import { NextResponse } from "next/server";

export const runtime = "nodejs";

/**
 * DELETE — principal removes teacher self-attendance for a single
 * subject+batch+date cell.  Also drops the owning session when it becomes
 * completely empty.  `teacherId` is optional — when omitted, all teacher
 * self-attendance rows tied to matching sessions are removed.
 */
export async function DELETE(req: Request) {
  const gate = await requirePrincipalPortal();
  if (!gate.ok) return gate.response;

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
