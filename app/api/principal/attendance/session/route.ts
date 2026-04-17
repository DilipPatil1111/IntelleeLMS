import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { hasPrincipalPortalAccess } from "@/lib/portal-access";
import { evaluateLowAttendanceForStudents } from "@/lib/attendance-threshold";
import { NextResponse } from "next/server";

export const runtime = "nodejs";

const TEACHER_STATUSES = ["PRESENT", "ABSENT", "LATE", "EXCUSED"] as const;
const STUDENT_STATUSES = ["PRESENT", "ABSENT", "LATE", "EXCUSED"] as const;
type TeacherStatus = (typeof TEACHER_STATUSES)[number];
type StudentStatus = (typeof STUDENT_STATUSES)[number];

/** UTC day bounds for a "YYYY-MM-DD" string — timezone-safe queries. */
function dayBounds(iso: string): { gte: Date; lte: Date } {
  const [y, m, d] = iso.substring(0, 10).split("-").map(Number);
  return {
    gte: new Date(Date.UTC(y, m - 1, d, 0, 0, 0, 0)),
    lte: new Date(Date.UTC(y, m - 1, d, 23, 59, 59, 999)),
  };
}

/** Per-student duplicate info returned inside the 409 payload. */
type StudentDuplicateInfo = {
  studentId: string;
  studentName: string;
  existingStatus: string;
  sessionId: string;
  sessionDate: string;
  startTime: string | null;
  endTime: string | null;
  submittedAt: string;
};

/** Details about an existing session returned in the 409 session-duplicate payload. */
type ExistingSessionInfo = {
  id: string;
  startTime: string | null;
  endTime: string | null;
  recordCount: number;
};

/**
 * Checks whether a session with the exact same subject + batch + date +
 * startTime + endTime already exists.  Returns its details if found.
 */
async function findExactSessionDuplicate(
  subjectId: string,
  batchId: string,
  sessionDate: string,
  startTime: string | null | undefined,
  endTime: string | null | undefined
): Promise<ExistingSessionInfo | null> {
  const bounds = dayBounds(sessionDate);
  const normStart = startTime || null;
  const normEnd = endTime || null;

  const existing = await db.attendanceSession.findFirst({
    where: {
      subjectId,
      batchId,
      sessionDate: bounds,
      startTime: normStart,
      endTime: normEnd,
    },
    select: {
      id: true,
      startTime: true,
      endTime: true,
      _count: { select: { records: true } },
    },
  });

  if (!existing) return null;
  return {
    id: existing.id,
    startTime: existing.startTime,
    endTime: existing.endTime,
    recordCount: existing._count.records,
  };
}

/**
 * For every student in `studentIds`, check whether they already have an
 * AttendanceRecord in any session for this subject + batch + calendar day.
 */
async function findStudentDuplicates(
  subjectId: string,
  batchId: string,
  sessionDate: string,
  studentIds: string[]
): Promise<StudentDuplicateInfo[]> {
  if (studentIds.length === 0) return [];

  const bounds = dayBounds(sessionDate);

  const existing = await db.attendanceRecord.findMany({
    where: {
      session: { subjectId, batchId, sessionDate: bounds },
      studentId: { in: studentIds },
    },
    include: {
      student: { select: { firstName: true, lastName: true } },
      session: {
        select: { id: true, sessionDate: true, startTime: true, endTime: true, createdAt: true },
      },
    },
    orderBy: { session: { createdAt: "asc" } },
  });

  return existing.map((r) => ({
    studentId: r.studentId,
    studentName: [r.student.firstName, r.student.lastName].filter(Boolean).join(" ").trim(),
    existingStatus: r.status,
    sessionId: r.session.id,
    sessionDate: r.session.sessionDate.toISOString(),
    startTime: r.session.startTime,
    endTime: r.session.endTime,
    submittedAt: r.session.createdAt.toISOString(),
  }));
}

/**
 * Deletes only the duplicate AttendanceRecord rows for `studentIds` on the
 * given subject + batch + date, then removes any resulting empty sessions.
 */
async function deleteDuplicateRecords(
  subjectId: string,
  batchId: string,
  sessionDate: string,
  studentIds: string[]
): Promise<void> {
  if (studentIds.length === 0) return;

  const bounds = dayBounds(sessionDate);

  const toDelete = await db.attendanceRecord.findMany({
    where: {
      session: { subjectId, batchId, sessionDate: bounds },
      studentId: { in: studentIds },
    },
    select: { id: true, attendanceSessionId: true },
  });

  if (toDelete.length === 0) return;

  await db.attendanceRecord.deleteMany({
    where: { id: { in: toDelete.map((r) => r.id) } },
  });

  // Clean up sessions that are now empty after record removal.
  const sessionIds = [...new Set(toDelete.map((r) => r.attendanceSessionId))];
  for (const sid of sessionIds) {
    const remaining = await db.attendanceRecord.count({
      where: { attendanceSessionId: sid },
    });
    if (remaining === 0) {
      await db.attendanceSession.delete({ where: { id: sid } }).catch(() => {/* already gone */});
    }
  }
}

/**
 * Principal creates a session and optional teacher self-attendance for any
 * assigned teacher (including when the principal is also assigned as teacher).
 */
export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!hasPrincipalPortalAccess(session)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await req.json().catch(() => ({})) as {
    subjectId?: string;
    batchId?: string;
    sessionDate?: string;
    startTime?: string | null;
    endTime?: string | null;
    attendance?: Record<string, string>;
    overrideHoliday?: boolean;
    teacherUserId?: string;
    teacherStatus?: string;
    /**
     * When true, duplicate student records are deleted before the new
     * session is created.
     */
    force?: boolean;
  };

  const {
    subjectId,
    batchId,
    sessionDate,
    startTime,
    endTime,
    attendance,
    overrideHoliday,
    teacherUserId,
    teacherStatus,
    force,
  } = body;

  if (!subjectId || !batchId || !sessionDate || !attendance || typeof attendance !== "object") {
    return NextResponse.json(
      { error: "subjectId, batchId, sessionDate, attendance map required" },
      { status: 400 }
    );
  }

  for (const st of Object.values(attendance)) {
    if (!STUDENT_STATUSES.includes(st as StudentStatus)) {
      return NextResponse.json(
        { error: "Invalid student attendance status" },
        { status: 400 }
      );
    }
  }

  const studentIds = Object.keys(attendance);

  if (!force) {
    // Check 1: exact session duplicate (same subject + batch + date + startTime + endTime).
    const exactSession = await findExactSessionDuplicate(
      subjectId, batchId, sessionDate, startTime, endTime
    );
    if (exactSession) {
      const timeLabel =
        exactSession.startTime && exactSession.endTime
          ? `${exactSession.startTime}–${exactSession.endTime}`
          : exactSession.startTime ?? sessionDate;
      return NextResponse.json(
        {
          duplicate: true,
          sessionDuplicate: true,
          students: [],
          existingSession: exactSession,
          message:
            `A session already exists for this subject on ${sessionDate} at ${timeLabel} ` +
            `with ${exactSession.recordCount} student record${exactSession.recordCount !== 1 ? "s" : ""}. ` +
            "Do you want to create another session anyway?",
        },
        { status: 409 }
      );
    }

    // Check 2: student-level duplicates (same student + subject + date, any session).
    const duplicates = await findStudentDuplicates(subjectId, batchId, sessionDate, studentIds);
    if (duplicates.length > 0) {
      return NextResponse.json(
        {
          duplicate: true,
          sessionDuplicate: false,
          students: duplicates,
          message:
            `${duplicates.length} student${duplicates.length !== 1 ? "s" : ""} below ` +
            "already have attendance records for this subject on this date. " +
            "Do you want to delete those and save the new attendance?",
        },
        { status: 409 }
      );
    }
  } else {
    await deleteDuplicateRecords(subjectId, batchId, sessionDate, studentIds);
  }

  const attendanceSession = await db.attendanceSession.create({
    data: {
      subjectId,
      batchId,
      sessionDate: new Date(sessionDate),
      startTime: startTime || null,
      endTime: endTime || null,
      overrideHoliday: overrideHoliday || false,
      createdById: session.user.id,
      records: {
        create: Object.entries(attendance).map(([studentId, status]) => ({
          studentId,
          status: status as StudentStatus,
        })),
      },
    },
  });

  let teacherRecorded = false;
  if (
    teacherUserId &&
    typeof teacherStatus === "string" &&
    TEACHER_STATUSES.includes(teacherStatus as TeacherStatus)
  ) {
    await db.teacherAttendance.create({
      data: {
        attendanceSessionId: attendanceSession.id,
        teacherUserId,
        status: teacherStatus as TeacherStatus,
      },
    });
    teacherRecorded = true;
  }

  await evaluateLowAttendanceForStudents(batchId, studentIds);

  return NextResponse.json({
    id: attendanceSession.id,
    teacherAttendanceRecorded: teacherRecorded,
  });
}
