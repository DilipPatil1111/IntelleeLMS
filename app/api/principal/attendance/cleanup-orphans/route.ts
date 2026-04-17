import { requirePrincipalPortal } from "@/lib/api-auth";
import { db } from "@/lib/db";
import { NextResponse } from "next/server";

export const runtime = "nodejs";

type OrphanItem = {
  sessionId: string;
  sessionDate: string;
  startTime: string | null;
  endTime: string | null;
  subject: { id: string; name: string };
  batch: { id: string; name: string; programId: string; programName: string };
  teacher: { id: string; name: string; status: string };
};

async function fetchOrphans(filter: {
  programId?: string;
  batchId?: string;
  subjectId?: string;
}): Promise<OrphanItem[]> {
  const sessions = await db.attendanceSession.findMany({
    where: {
      teacherAttendance: { isNot: null },
      records: { none: {} },
      ...(filter.batchId ? { batchId: filter.batchId } : {}),
      ...(filter.subjectId ? { subjectId: filter.subjectId } : {}),
      ...(filter.programId
        ? { batch: { programId: filter.programId } }
        : {}),
    },
    include: {
      subject: { select: { id: true, name: true } },
      batch: {
        select: {
          id: true,
          name: true,
          program: { select: { id: true, name: true } },
        },
      },
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
        programId: s.batch.program.id,
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

/** GET — list orphaned teacher attendance rows across the school. */
export async function GET(req: Request) {
  const gate = await requirePrincipalPortal();
  if (!gate.ok) return gate.response;

  const { searchParams } = new URL(req.url);
  const programId = searchParams.get("programId") ?? undefined;
  const batchId = searchParams.get("batchId") ?? undefined;
  const subjectId = searchParams.get("subjectId") ?? undefined;

  const orphans = await fetchOrphans({ programId, batchId, subjectId });
  return NextResponse.json({ orphans });
}

/**
 * DELETE — principal bulk cleanup.  Body: `{ sessionIds?: string[] }` — when
 * omitted, every orphaned session in the whole system is cleaned up.
 */
export async function DELETE(req: Request) {
  const gate = await requirePrincipalPortal();
  if (!gate.ok) return gate.response;

  const body = (await req.json().catch(() => ({}))) as { sessionIds?: string[] };
  const requested = Array.isArray(body.sessionIds) ? body.sessionIds : null;

  const orphanSessions = await db.attendanceSession.findMany({
    where: {
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
