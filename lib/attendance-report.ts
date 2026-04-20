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

/** YYYY-MM-DD (UTC) — timezone safe. */
function toYmdUtc(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function todayYmdUtc(): string {
  return toYmdUtc(new Date());
}

/** Pick the later of two YYYY-MM-DD strings ("" treated as empty). */
function maxYmd(a: string, b: string): string {
  if (!a) return b;
  if (!b) return a;
  return a >= b ? a : b;
}

/** Pick the earlier of two YYYY-MM-DD strings ("" treated as empty). */
function minYmd(a: string, b: string): string {
  if (!a) return b;
  if (!b) return a;
  return a <= b ? a : b;
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

  // Batch fallback: when there is no ProgramEnrollment row but the student's
  // profile batch belongs to the same program, use it so the header + default
  // period are still populated (matches the attendance recording path).
  let batchName = enrollment?.batch?.name ?? null;
  let batchStartDate: Date | null = enrollment?.batch?.startDate ?? null;
  let batchEndDate: Date | null = enrollment?.batch?.endDate ?? null;

  if (!batchStartDate && !batchEndDate && user.studentProfile?.batchId) {
    const fallbackBatch = await db.batch.findUnique({
      where: { id: user.studentProfile.batchId },
      select: { name: true, startDate: true, endDate: true, programId: true },
    });
    if (fallbackBatch && fallbackBatch.programId === programId) {
      batchName = batchName ?? fallbackBatch.name;
      batchStartDate = fallbackBatch.startDate;
      batchEndDate = fallbackBatch.endDate;
    }
  }

  const batchStartYmd = batchStartDate ? toYmdUtc(batchStartDate) : "";
  const batchEndYmd = batchEndDate ? toYmdUtc(batchEndDate) : "";

  // Build the Prisma date filter:
  //   - If the caller passed an explicit startDate / endDate, honor it.
  //   - Otherwise DO NOT clamp to batch.endDate / today. Historical production
  //     bug: attendance sessions are allowed to be recorded for dates outside
  //     the planned batch window (e.g. make-up or future-dated sessions), and
  //     clamping here silently hid those rows from the report even though the
  //     student's own attendance page (which does not clamp) listed them.
  const dateFilter: { gte?: Date; lte?: Date } = {};
  if (startDate) dateFilter.gte = new Date(`${startDate}T00:00:00.000Z`);
  if (endDate) dateFilter.lte = new Date(`${endDate}T23:59:59.999Z`);

  const records = await db.attendanceRecord.findMany({
    where: {
      studentId: studentUserId,
      session: {
        subject: { programId },
        ...(dateFilter.gte || dateFilter.lte ? { sessionDate: dateFilter } : {}),
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
    orderBy: [
      { session: { sessionDate: "asc" } },
      { session: { startTime: "asc" } },
    ],
  });

  const rows: AttendanceDayRow[] = records.map((r) => ({
    date: toYmdUtc(r.session.sessionDate),
    subject: r.session.subject?.name ?? "—",
    startTime: r.session.startTime,
    endTime: r.session.endTime,
    status: r.status as AttendanceDayRow["status"],
    durationMinutes: slotMinutes(r.session.startTime, r.session.endTime),
  }));

  // Compute the effective period for display:
  //   - Explicit user input wins.
  //   - Otherwise use batch dates if available, and widen to actual record
  //     range so the header reflects what the user sees in the table (e.g.
  //     attendance posted beyond the planned batch end).
  const recordMinYmd = rows.length ? rows[0].date : "";
  const recordMaxYmd = rows.length ? rows[rows.length - 1].date : "";
  const today = todayYmdUtc();

  const periodStart =
    startDate || minYmd(batchStartYmd, recordMinYmd) || "";
  const periodEnd =
    endDate ||
    maxYmd(maxYmd(batchEndYmd, today), recordMaxYmd) ||
    today;

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
