import { requireTeacherPortal } from "@/lib/api-auth";
import { db } from "@/lib/db";
import { getTeacherVisibleBatchIds } from "@/lib/teacher-visible-batches";
import { NextResponse } from "next/server";
import type { Session } from "next-auth";

export const runtime = "nodejs";

const STUDENT_STATUSES = ["PRESENT", "ABSENT", "LATE", "EXCUSED"] as const;
const TEACHER_STATUSES = ["PRESENT", "ABSENT", "LATE", "EXCUSED"] as const;
type StudentStatus = (typeof STUDENT_STATUSES)[number];
type TeacherStatus = (typeof TEACHER_STATUSES)[number];

/**
 * Ensures the current teacher is allowed to modify this session.
 * Allowed when (a) the teacher created the session, OR (b) the teacher has
 * visibility on the session's batch via TeacherProgram / assignments.
 */
async function canTeacherManage(
  teacherUserId: string,
  sessionId: string,
  session: Session,
) {
  const row = await db.attendanceSession.findUnique({
    where: { id: sessionId },
    select: { id: true, createdById: true, batchId: true },
  });
  if (!row) return { ok: false as const, status: 404, error: "Not found" };

  if (row.createdById === teacherUserId) return { ok: true as const, row };

  const visible = await getTeacherVisibleBatchIds(teacherUserId, session);
  if (!visible.includes(row.batchId)) {
    return { ok: false as const, status: 403, error: "Forbidden" };
  }
  return { ok: true as const, row };
}

/** GET — fetch the session details (students + teacher attendance) for the edit modal. */
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const gate = await requireTeacherPortal();
  if (!gate.ok) return gate.response;
  const authSession = gate.session;

  const { id } = await params;
  const guard = await canTeacherManage(authSession.user.id, id, authSession);
  if (!guard.ok) {
    return NextResponse.json({ error: guard.error }, { status: guard.status });
  }

  const full = await db.attendanceSession.findUnique({
    where: { id },
    include: {
      subject: { select: { id: true, name: true } },
      batch: { select: { id: true, name: true } },
      records: {
        include: {
          student: { select: { id: true, firstName: true, lastName: true } },
        },
      },
      teacherAttendance: true,
    },
  });
  if (!full) return NextResponse.json({ error: "Not found" }, { status: 404 });

  return NextResponse.json({
    id: full.id,
    sessionDate: full.sessionDate.toISOString().substring(0, 10),
    startTime: full.startTime,
    endTime: full.endTime,
    subject: full.subject,
    batch: full.batch,
    records: full.records.map((r) => ({
      studentId: r.studentId,
      status: r.status,
      studentName: [r.student.firstName, r.student.lastName].filter(Boolean).join(" ").trim(),
    })),
    teacherAttendance: full.teacherAttendance
      ? { status: full.teacherAttendance.status }
      : null,
  });
}

/**
 * PATCH — teacher edits a recent session.
 * Supported fields:
 *   - startTime / endTime  (string "HH:mm" or null)
 *   - teacherSelfStatus    (updates/creates the TeacherAttendance row)
 *   - attendance           (Record<studentId, status>) — upserts student rows
 */
export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const gate = await requireTeacherPortal();
  if (!gate.ok) return gate.response;
  const authSession = gate.session;

  const { id } = await params;
  const guard = await canTeacherManage(authSession.user.id, id, authSession);
  if (!guard.ok) {
    return NextResponse.json({ error: guard.error }, { status: guard.status });
  }

  const body = await req.json().catch(() => ({})) as {
    startTime?: string | null;
    endTime?: string | null;
    teacherSelfStatus?: string | null;
    attendance?: Record<string, string>;
  };

  const updates: {
    startTime?: string | null;
    endTime?: string | null;
  } = {};

  if ("startTime" in body) updates.startTime = body.startTime || null;
  if ("endTime" in body) updates.endTime = body.endTime || null;

  if (Object.keys(updates).length > 0) {
    await db.attendanceSession.update({ where: { id }, data: updates });
  }

  // ── Student records: upsert each provided row ────────────────────────────
  if (body.attendance && typeof body.attendance === "object") {
    for (const [studentId, status] of Object.entries(body.attendance)) {
      if (!STUDENT_STATUSES.includes(status as StudentStatus)) continue;
      await db.attendanceRecord.upsert({
        where: {
          attendanceSessionId_studentId: {
            attendanceSessionId: id,
            studentId,
          },
        },
        create: {
          attendanceSessionId: id,
          studentId,
          status: status as StudentStatus,
        },
        update: { status: status as StudentStatus },
      });
    }
  }

  // ── Teacher self-attendance ──────────────────────────────────────────────
  if (body.teacherSelfStatus !== undefined) {
    if (body.teacherSelfStatus === null || body.teacherSelfStatus === "") {
      await db.teacherAttendance.deleteMany({ where: { attendanceSessionId: id } });
    } else if (TEACHER_STATUSES.includes(body.teacherSelfStatus as TeacherStatus)) {
      const existing = await db.teacherAttendance.findUnique({
        where: { attendanceSessionId: id },
      });
      if (existing) {
        await db.teacherAttendance.update({
          where: { id: existing.id },
          data: { status: body.teacherSelfStatus as TeacherStatus },
        });
      } else {
        await db.teacherAttendance.create({
          data: {
            attendanceSessionId: id,
            teacherUserId: authSession.user.id,
            status: body.teacherSelfStatus as TeacherStatus,
          },
        });
      }
    }
  }

  return NextResponse.json({ ok: true });
}

/**
 * DELETE — teacher deletes a session.  The schema cascades AttendanceRecord
 * rows; we explicitly drop the TeacherAttendance row first (1:1 optional
 * relation without cascade) so both student and teacher attendance are removed.
 */
export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const gate = await requireTeacherPortal();
  if (!gate.ok) return gate.response;
  const authSession = gate.session;

  const { id } = await params;
  const guard = await canTeacherManage(authSession.user.id, id, authSession);
  if (!guard.ok) {
    return NextResponse.json({ error: guard.error }, { status: guard.status });
  }

  // AttendanceRecord and TeacherAttendance both cascade on session delete.
  await db.attendanceSession.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
