import { requireTeacherPortal } from "@/lib/api-auth";
import { db } from "@/lib/db";
import { getTeacherVisibleBatchIds } from "@/lib/teacher-visible-batches";
import { NextResponse } from "next/server";

export const runtime = "nodejs";

/**
 * Shape of an orphaned session — teacher self-attendance exists but NO student
 * attendance records remain.  Surfaced to both Teacher and Principal UIs so
 * they can decide whether to remove the stale teacher hours.
 */
type OrphanItem = {
  sessionId: string;
  sessionDate: string;
  startTime: string | null;
  endTime: string | null;
  subject: { id: string; name: string };
  batch: { id: string; name: string; programName: string };
  teacher: { id: string; name: string; status: string };
};

async function findOrphansForBatches(batchIds: string[], subjectId?: string) {
  if (batchIds.length === 0) return [] as OrphanItem[];

  // "orphan": session has teacherAttendance but 0 student records.
  const sessions = await db.attendanceSession.findMany({
    where: {
      batchId: { in: batchIds },
      ...(subjectId ? { subjectId } : {}),
      teacherAttendance: { isNot: null },
      records: { none: {} },
    },
    include: {
      subject: { select: { id: true, name: true } },
      batch: { select: { id: true, name: true, program: { select: { name: true } } } },
      teacherAttendance: {
        include: {
          teacher: { select: { id: true, firstName: true, lastName: true } },
        },
      },
    },
    orderBy: { sessionDate: "desc" },
  });

  return sessions
    .filter((s) => s.teacherAttendance)
    .map<OrphanItem>((s) => ({
      sessionId: s.id,
      sessionDate: s.sessionDate.toISOString(),
      startTime: s.startTime,
      endTime: s.endTime,
      subject: s.subject,
      batch: {
        id: s.batch.id,
        name: s.batch.name,
        programName: s.batch.program.name,
      },
      teacher: {
        id: s.teacherAttendance!.teacher.id,
        name:
          [s.teacherAttendance!.teacher.firstName, s.teacherAttendance!.teacher.lastName]
            .filter(Boolean)
            .join(" ")
            .trim() || s.teacherAttendance!.teacher.id,
        status: s.teacherAttendance!.status,
      },
    }));
}

/** GET — list orphaned teacher attendance rows the teacher can see. */
export async function GET(req: Request) {
  const gate = await requireTeacherPortal();
  if (!gate.ok) return gate.response;
  const authSession = gate.session;

  const { searchParams } = new URL(req.url);
  const batchId = searchParams.get("batchId");
  const subjectId = searchParams.get("subjectId") ?? undefined;

  const visible = await getTeacherVisibleBatchIds(authSession.user.id, authSession);
  let batchIds = visible;
  if (batchId) {
    if (!visible.includes(batchId)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    batchIds = [batchId];
  }

  const orphans = await findOrphansForBatches(batchIds, subjectId);
  return NextResponse.json({ orphans });
}

/**
 * DELETE — remove orphaned teacher attendance rows (and the now-empty
 * sessions).  Body: `{ sessionIds?: string[] }` — when omitted, every orphan
 * visible to the current teacher is cleaned up.
 */
export async function DELETE(req: Request) {
  const gate = await requireTeacherPortal();
  if (!gate.ok) return gate.response;
  const authSession = gate.session;

  const body = (await req.json().catch(() => ({}))) as { sessionIds?: string[] };
  const requested = Array.isArray(body.sessionIds) ? body.sessionIds : null;

  const visible = await getTeacherVisibleBatchIds(authSession.user.id, authSession);

  // Re-query to make sure we only delete genuine orphans in visible batches.
  const orphanSessions = await db.attendanceSession.findMany({
    where: {
      batchId: { in: visible },
      teacherAttendance: { isNot: null },
      records: { none: {} },
      ...(requested ? { id: { in: requested } } : {}),
    },
    select: { id: true },
  });

  if (orphanSessions.length === 0) {
    return NextResponse.json({ ok: true, removed: 0 });
  }

  const ids = orphanSessions.map((s) => s.id);
  await db.teacherAttendance.deleteMany({
    where: { attendanceSessionId: { in: ids } },
  });
  await db.attendanceSession.deleteMany({ where: { id: { in: ids } } });

  return NextResponse.json({ ok: true, removed: ids.length });
}
