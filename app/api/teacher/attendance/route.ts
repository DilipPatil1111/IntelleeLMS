import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { NextResponse } from "next/server";
import { evaluateLowAttendanceForStudents } from "@/lib/attendance-threshold";

const TEACHER_STATUSES = ["PRESENT", "ABSENT", "LATE", "EXCUSED"] as const;

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  const { subjectId, batchId, sessionDate, startTime, endTime, attendance, overrideHoliday, teacherSelfStatus } = body;

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
        create: Object.entries(attendance as Record<string, string>).map(([studentId, status]) => ({
          studentId,
          status: status as "PRESENT" | "ABSENT" | "LATE" | "EXCUSED",
        })),
      },
    },
  });

  const statusOk =
    typeof teacherSelfStatus === "string" && TEACHER_STATUSES.includes(teacherSelfStatus as (typeof TEACHER_STATUSES)[number]);

  if (statusOk) {
    await db.teacherAttendance.create({
      data: {
        attendanceSessionId: attendanceSession.id,
        teacherUserId: session.user.id,
        status: teacherSelfStatus as "PRESENT" | "ABSENT" | "LATE" | "EXCUSED",
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

  const studentIds = Object.keys(attendance as Record<string, string>);
  await evaluateLowAttendanceForStudents(batchId, studentIds);

  return NextResponse.json({ id: attendanceSession.id, teacherAttendanceRecorded: statusOk });
}
