import { requireTeacherPortal } from "@/lib/api-auth";
import { db } from "@/lib/db";
import { NextResponse } from "next/server";
import { evaluateLowAttendanceForStudents } from "@/lib/attendance-threshold";

const TEACHER_STATUSES = ["PRESENT", "ABSENT", "LATE", "EXCUSED"] as const;
type TeacherStatus = (typeof TEACHER_STATUSES)[number];

/** UTC day bounds for a "YYYY-MM-DD" string — timezone-safe queries. */
function dayBounds(iso: string): { gte: Date; lte: Date } {
  const [y, m, d] = iso.substring(0, 10).split("-").map(Number);
  return {
    gte: new Date(Date.UTC(y, m - 1, d, 0, 0, 0, 0)),
    lte: new Date(Date.UTC(y, m - 1, d, 23, 59, 59, 999)),
  };
}

/** Per-student duplicate info returned inside the 409 payload. */
export type StudentDuplicateInfo = {
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
 * Returns only the students that are actual duplicates.
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
 * Deletes only the AttendanceRecord rows for `studentIds` that fall on the
 * same subject + batch + date, then cleans up any now-empty sessions.
 */
async function deleteDuplicateRecords(
  subjectId: string,
  batchId: string,
  sessionDate: string,
  studentIds: string[]
): Promise<void> {
  if (studentIds.length === 0) return;

  const bounds = dayBounds(sessionDate);

  // Find the IDs of records to remove
  const toDelete = await db.attendanceRecord.findMany({
    where: {
      session: { subjectId, batchId, sessionDate: bounds },
      studentId: { in: studentIds },
    },
    select: { id: true, attendanceSessionId: true },
  });

  if (toDelete.length === 0) return;

  // Delete those specific records
  await db.attendanceRecord.deleteMany({
    where: { id: { in: toDelete.map((r) => r.id) } },
  });

  // Remove sessions that are now completely empty
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

export async function POST(req: Request) {
  const gate = await requireTeacherPortal();
  if (!gate.ok) return gate.response;
  const session = gate.session;

  const body = await req.json();
  const {
    subjectId,
    batchId,
    sessionDate,
    startTime,
    endTime,
    attendance,
    overrideHoliday,
    teacherSelfStatus,
    /**
     * When true: the user confirmed they want to delete the duplicate student
     * records and proceed with saving the new attendance.
     */
    force,
  } = body as {
    subjectId?: string;
    batchId?: string;
    sessionDate?: string;
    startTime?: string | null;
    endTime?: string | null;
    attendance?: Record<string, string>;
    overrideHoliday?: boolean;
    teacherSelfStatus?: string;
    force?: boolean;
  };

  if (!subjectId || !batchId || !sessionDate || !attendance) {
    return NextResponse.json(
      { error: "subjectId, batchId, sessionDate, attendance required" },
      { status: 400 }
    );
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
    // User confirmed → remove only the duplicate student records (and empty sessions).
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
          status: status as "PRESENT" | "ABSENT" | "LATE" | "EXCUSED",
        })),
      },
    },
  });

  const statusOk =
    typeof teacherSelfStatus === "string" &&
    TEACHER_STATUSES.includes(teacherSelfStatus as TeacherStatus);

  if (statusOk) {
    await db.teacherAttendance.create({
      data: {
        attendanceSessionId: attendanceSession.id,
        teacherUserId: session.user.id,
        status: teacherSelfStatus as TeacherStatus,
      },
    });
  } else {
    await db.notification.create({
      data: {
        userId: session.user.id,
        type: "TEACHER_SELF_ATTENDANCE_REQUIRED",
        title: "Record your attendance for this session",
        message: `You submitted student attendance for ${new Date(sessionDate).toLocaleDateString()} but did not record your own status. Open attendance and confirm your presence.`,
        link: `/teacher/attendance?pendingSession=${attendanceSession.id}`,
      },
    });
  }

  await evaluateLowAttendanceForStudents(batchId, studentIds);

  return NextResponse.json({
    id: attendanceSession.id,
    teacherAttendanceRecorded: statusOk,
  });
}
