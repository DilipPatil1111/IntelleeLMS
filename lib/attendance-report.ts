import { db } from "@/lib/db";

export type AttendanceDayRow = {
  date: string;
  subject: string;
  startTime: string | null;
  endTime: string | null;
  status: "PRESENT" | "ABSENT" | "LATE" | "EXCUSED";
  durationMinutes: number;
};

export type AttendanceReportData = {
  collegeName: string;
  generatedAt: string;
  studentName: string;
  enrollmentNo: string | null;
  programName: string;
  programType: string | null;
  programCategory: string | null;
  programDuration: string | null;
  batchName: string | null;
  periodStart: string;
  periodEnd: string;
  summary: {
    totalSessions: number;
    present: number;
    late: number;
    excused: number;
    absent: number;
    attendanceRate: number;
    totalDaysAttended: number;
    totalHoursAttended: number;
    totalScheduledHours: number;
  };
  rows: AttendanceDayRow[];
};

function timeToMinutes(t: string | null | undefined): number | null {
  if (!t) return null;
  const m = t.match(/(\d{1,2}):(\d{2})/);
  if (!m) return null;
  return parseInt(m[1], 10) * 60 + parseInt(m[2], 10);
}

function slotMinutes(start: string | null, end: string | null): number {
  const a = timeToMinutes(start);
  const b = timeToMinutes(end);
  if (a == null || b == null || b <= a) return 0;
  return b - a;
}

function collegeName(): string {
  return process.env.NEXT_PUBLIC_COLLEGE_NAME?.trim() || "Intellee College";
}

export async function getAttendanceReportData(opts: {
  studentUserId: string;
  programId: string;
  startDate?: string;
  endDate?: string;
}): Promise<AttendanceReportData | null> {
  const { studentUserId, programId, startDate, endDate } = opts;

  const user = await db.user.findUnique({
    where: { id: studentUserId },
    select: {
      firstName: true,
      lastName: true,
      studentProfile: { select: { enrollmentNo: true, batchId: true } },
    },
  });
  if (!user) return null;

  const program = await db.program.findUnique({
    where: { id: programId },
    select: {
      name: true,
      durationText: true,
      programType: { select: { name: true } },
      programCategory: { select: { name: true } },
    },
  });
  if (!program) return null;

  const enrollment = await db.programEnrollment.findFirst({
    where: { userId: studentUserId, programId },
    select: {
      batchId: true,
      batch: { select: { name: true, startDate: true, endDate: true } },
    },
  });

  const batchId = enrollment?.batchId ?? user.studentProfile?.batchId ?? null;
  const batchName = enrollment?.batch?.name ?? null;

  const periodStart = startDate || enrollment?.batch?.startDate?.toISOString().slice(0, 10) || "";
  const periodEnd = endDate || enrollment?.batch?.endDate?.toISOString().slice(0, 10) || new Date().toISOString().slice(0, 10);

  const dateFilter: Record<string, unknown> = {};
  if (periodStart) dateFilter.gte = new Date(periodStart);
  if (periodEnd) {
    const end = new Date(periodEnd);
    end.setHours(23, 59, 59, 999);
    dateFilter.lte = end;
  }

  const records = await db.attendanceRecord.findMany({
    where: {
      studentId: studentUserId,
      session: {
        subject: { programId },
        ...(Object.keys(dateFilter).length > 0 ? { sessionDate: dateFilter } : {}),
      },
    },
    include: {
      session: {
        select: {
          sessionDate: true,
          startTime: true,
          endTime: true,
          subject: { select: { name: true } },
        },
      },
    },
    orderBy: { session: { sessionDate: "asc" } },
  });

  const rows: AttendanceDayRow[] = records.map((r) => ({
    date: r.session.sessionDate.toISOString().slice(0, 10),
    subject: r.session.subject?.name ?? "—",
    startTime: r.session.startTime,
    endTime: r.session.endTime,
    status: r.status as AttendanceDayRow["status"],
    durationMinutes: slotMinutes(r.session.startTime, r.session.endTime),
  }));

  const totalSessions = rows.length;
  const present = rows.filter((r) => r.status === "PRESENT" || r.status === "EXCUSED").length;
  const late = rows.filter((r) => r.status === "LATE").length;
  const excused = rows.filter((r) => r.status === "EXCUSED").length;
  const absent = rows.filter((r) => r.status === "ABSENT").length;
  const attendanceRate = totalSessions > 0 ? Math.round(((present + late) / totalSessions) * 100) : 0;

  const attendedRows = rows.filter((r) => r.status === "PRESENT" || r.status === "LATE" || r.status === "EXCUSED");
  const uniqueDates = new Set(attendedRows.map((r) => r.date));
  const totalAttendedMinutes = attendedRows.reduce((sum, r) => sum + r.durationMinutes, 0);
  const totalScheduledMinutes = rows.reduce((sum, r) => sum + r.durationMinutes, 0);

  return {
    collegeName: collegeName(),
    generatedAt: new Date().toISOString(),
    studentName: `${user.firstName} ${user.lastName}`,
    enrollmentNo: user.studentProfile?.enrollmentNo ?? null,
    programName: program.name,
    programType: program.programType?.name ?? null,
    programCategory: program.programCategory?.name ?? null,
    programDuration: program.durationText ?? null,
    batchName,
    periodStart,
    periodEnd,
    summary: {
      totalSessions,
      present,
      late,
      excused,
      absent,
      attendanceRate,
      totalDaysAttended: uniqueDates.size,
      totalHoursAttended: Math.round((totalAttendedMinutes / 60) * 10) / 10,
      totalScheduledHours: Math.round((totalScheduledMinutes / 60) * 10) / 10,
    },
    rows,
  };
}
