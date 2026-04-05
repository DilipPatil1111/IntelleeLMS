import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { hasPrincipalPortalAccess } from "@/lib/portal-access";
import { evaluateLowAttendanceForStudents } from "@/lib/attendance-threshold";
import { NextResponse } from "next/server";

const TEACHER_STATUSES = ["PRESENT", "ABSENT", "LATE", "EXCUSED"] as const;
const STUDENT_STATUSES = ["PRESENT", "ABSENT", "LATE", "EXCUSED"] as const;

export const runtime = "nodejs";

/**
 * Principal creates a session and optional teacher self-attendance for any assigned teacher
 * (including when the principal is also assigned as teacher).
 */
export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!hasPrincipalPortalAccess(session)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const body = await req.json().catch(() => ({}));
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
  } = body as {
    subjectId?: string;
    batchId?: string;
    sessionDate?: string;
    startTime?: string | null;
    endTime?: string | null;
    attendance?: Record<string, string>;
    overrideHoliday?: boolean;
    /** User id of the teacher whose self-attendance is recorded (principal may pass their own id). */
    teacherUserId?: string;
    teacherStatus?: string;
  };

  if (!subjectId || !batchId || !sessionDate || !attendance || typeof attendance !== "object") {
    return NextResponse.json({ error: "subjectId, batchId, sessionDate, attendance map required" }, { status: 400 });
  }

  for (const st of Object.values(attendance)) {
    if (!STUDENT_STATUSES.includes(st as (typeof STUDENT_STATUSES)[number])) {
      return NextResponse.json({ error: "Invalid student attendance status" }, { status: 400 });
    }
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

  let teacherRecorded = false;
  if (
    teacherUserId &&
    typeof teacherStatus === "string" &&
    TEACHER_STATUSES.includes(teacherStatus as (typeof TEACHER_STATUSES)[number])
  ) {
    await db.teacherAttendance.create({
      data: {
        attendanceSessionId: attendanceSession.id,
        teacherUserId,
        status: teacherStatus as "PRESENT" | "ABSENT" | "LATE" | "EXCUSED",
      },
    });
    teacherRecorded = true;
  }

  const studentIds = Object.keys(attendance);
  await evaluateLowAttendanceForStudents(batchId, studentIds);

  return NextResponse.json({ id: attendanceSession.id, teacherAttendanceRecorded: teacherRecorded });
}
