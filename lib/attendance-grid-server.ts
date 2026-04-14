import { db } from "@/lib/db";
import type { AttendanceStatus } from "@/app/generated/prisma/enums";
import { eachLocalDayInclusive, endOfLocalDay, formatYmd, startOfLocalDay } from "@/lib/day-boundaries";
import { slotDurationMinutes } from "@/lib/program-calendar-hours";

/** Avoid huge payloads / OOM on misconfigured batch date ranges (~4 years max). */
const MAX_GRID_DAYS = 1500;

/** Map UI cell to DB (1/0/L like spreadsheet, plus legacy P/A/L). */
export function displayToStatus(letter: string): AttendanceStatus | null {
  const u = letter.trim();
  if (u === "1") return "PRESENT";
  if (u === "0") return "ABSENT";
  const up = u.toUpperCase();
  if (up === "P" || up === "PRESENT") return "PRESENT";
  if (up === "A" || up === "ABSENT") return "ABSENT";
  if (up === "L" || up === "LATE") return "LATE";
  return null;
}

export function statusToDisplay(status: AttendanceStatus): string {
  if (status === "PRESENT") return "1";
  if (status === "ABSENT") return "0";
  if (status === "LATE") return "L";
  if (status === "EXCUSED") return "P"; // Excused displays as "P" with violet bg
  return "";
}

/** @deprecated use displayToStatus */
export function letterToStatus(letter: string): AttendanceStatus | null {
  return displayToStatus(letter);
}

export type DateColumnMeta = {
  teachersLabel: string;
  teacherHourLines: { label: string; value: string }[];
  timeRange: string;
  topic: string;
  hoursForDay: number;
};

/** Footer rows: per-teacher scheduled hours + self-attendance (P/A/L/E/—) per date. */
export type TeacherFooterRow = {
  teacherId: string;
  firstName: string;
  lastName: string;
  byDate: Record<string, { hours: number; attendance: string }>;
};

function teacherSelfAttendanceShort(status: AttendanceStatus): string {
  if (status === "PRESENT") return "P";
  if (status === "ABSENT") return "A";
  if (status === "LATE") return "L";
  if (status === "EXCUSED") return "PE"; // Excused: displays "P" with violet color
  return "—";
}

export async function loadAttendanceGridData(batchId: string, subjectId: string) {
  const batch = await db.batch.findUnique({
    where: { id: batchId },
    include: {
      program: true,
      academicYear: true,
      students: {
        include: { user: { select: { id: true, firstName: true, lastName: true } } },
      },
    },
  });
  if (!batch) return null;

  const from = startOfLocalDay(new Date(batch.startDate));
  const to = endOfLocalDay(new Date(batch.endDate));
  const days = eachLocalDayInclusive(from, to);
  let dateKeys = days.map((d) => formatYmd(d));
  const gridTruncated = dateKeys.length > MAX_GRID_DAYS;
  if (gridTruncated) {
    dateKeys = dateKeys.slice(0, MAX_GRID_DAYS);
  }

  const sessions = await db.attendanceSession.findMany({
    where: {
      batchId,
      subjectId,
      sessionDate: { gte: from, lte: to },
    },
    include: {
      records: { select: { studentId: true, status: true } },
      teacherAttendance: { select: { teacherUserId: true, status: true } },
    },
  });

  const sessionByYmd = new Map<string, (typeof sessions)[0]>();
  for (const s of sessions) {
    const ymd = formatYmd(startOfLocalDay(new Date(s.sessionDate)));
    sessionByYmd.set(ymd, s);
  }

  const calendarSlots =
    (await db.programCalendarSlot?.findMany({
      where: {
        batchId,
        slotDate: { gte: from, lte: to },
      },
      include: {
        teacher: { select: { firstName: true, lastName: true } },
        subject: { select: { id: true, name: true } },
      },
      orderBy: [{ slotDate: "asc" }, { sortOrder: "asc" }, { startTime: "asc" }],
    })) ?? [];

  const subject = await db.subject.findUnique({ where: { id: subjectId }, select: { name: true } });

  const sessionTeacherIds = [
    ...new Set(sessions.map((s) => s.teacherAttendance?.teacherUserId).filter((x): x is string => Boolean(x))),
  ];
  const sessionTeacherUsers =
    sessionTeacherIds.length > 0
      ? await db.user.findMany({
          where: { id: { in: sessionTeacherIds } },
          select: { id: true, firstName: true, lastName: true },
        })
      : [];
  const sessionTeacherById = new Map(sessionTeacherUsers.map((u) => [u.id, u]));

  const dateMeta: Record<string, DateColumnMeta> = {};
  for (const ymd of dateKeys) {
    const daySlots = calendarSlots.filter((sl) => formatYmd(startOfLocalDay(new Date(sl.slotDate))) === ymd);
    const sessionSlots = daySlots.filter((sl) => sl.slotType === "SESSION");
    /** Calendar rows for the grid’s subject (ignore slots for other subjects on the same day). */
    const sessionSlotsForSubject = sessionSlots.filter(
      (sl) => sl.subjectId == null || sl.subjectId === subjectId
    );
    const sess = sessionByYmd.get(ymd);

    const byTeacherFirst = new Map<string, number>();
    for (const sl of sessionSlotsForSubject) {
      const key = sl.teacher?.firstName?.trim() || sl.teacher?.lastName?.trim() || "—";
      const h = slotDurationMinutes(sl.startTime, sl.endTime) / 60;
      byTeacherFirst.set(key, (byTeacherFirst.get(key) || 0) + h);
    }

    let teacherHourLines = [...byTeacherFirst.entries()].map(([name, h]) => ({
      label: `${name} Hrs`,
      value: String(Math.round(h * 10) / 10),
    }));

    let teachersLabel =
      [...byTeacherFirst.keys()].map((n) => `${n}:`).join(" ") || "—";
    if (teachersLabel === "—" && daySlots.length > 0) {
      const names = [
        ...new Set(
          daySlots.map((sl) => sl.teacher?.firstName?.trim() || sl.teacher?.lastName?.trim() || "—")
        ),
      ];
      teachersLabel = names.map((n) => `${n}:`).join(" ");
    }

    /** Single-session attendance (no calendar row): show duration and teacher line from AttendanceSession. */
    if (teacherHourLines.length === 0 && sess?.startTime && sess?.endTime) {
      const durH = slotDurationMinutes(sess.startTime, sess.endTime) / 60;
      if (durH > 0 && sess.teacherAttendance) {
        const u = sessionTeacherById.get(sess.teacherAttendance.teacherUserId);
        const key = u
          ? u.firstName?.trim() || u.lastName?.trim() || `${u.firstName} ${u.lastName}`.trim()
          : "Teacher";
        teacherHourLines = [{ label: `${key} Hrs`, value: String(Math.round(durH * 10) / 10) }];
        teachersLabel = `${key}:`;
      }
    }

    let timeRange = "—";
    if (sessionSlotsForSubject[0]) {
      timeRange = `${sessionSlotsForSubject[0].startTime} TO ${sessionSlotsForSubject[0].endTime}`;
    } else if (sess?.startTime && sess?.endTime) {
      timeRange = `${sess.startTime} TO ${sess.endTime}`;
    }

    let hoursForDay = 0;
    for (const sl of sessionSlotsForSubject) {
      hoursForDay += slotDurationMinutes(sl.startTime, sl.endTime) / 60;
    }
    if (hoursForDay === 0 && sess?.startTime && sess?.endTime) {
      hoursForDay = slotDurationMinutes(sess.startTime, sess.endTime) / 60;
    }
    if (hoursForDay === 0) hoursForDay = 1;

    const topic =
      sessionSlotsForSubject.find((sl) => sl.subjectId === subjectId)?.subject?.name ||
      subject?.name ||
      sess?.topic ||
      "—";

    dateMeta[ymd] = {
      teachersLabel,
      teacherHourLines,
      timeRange,
      topic: topic || "—",
      hoursForDay: Math.round(hoursForDay * 10) / 10,
    };
  }

  const students = batch.students
    .filter((sp): sp is typeof sp & { user: NonNullable<typeof sp.user> } => sp.user != null)
    .map((sp) => ({
      id: sp.user.id,
      firstName: sp.user.firstName,
      lastName: sp.user.lastName,
    }));

  const cells: Record<string, Record<string, string>> = {};
  for (const st of students) {
    cells[st.id] = {};
    for (const ymd of dateKeys) {
      const sess = sessionByYmd.get(ymd);
      const rec = sess?.records.find((r) => r.studentId === st.id);
      cells[st.id][ymd] = rec ? statusToDisplay(rec.status as AttendanceStatus) : "";
    }
  }

  const academicYearId = batch.academicYearId;
  const holidays = await db.holiday.findMany({
    where: { academicYearId },
    select: { date: true, name: true, type: true },
  });
  const holidayYmds = new Set(holidays.map((h) => formatYmd(startOfLocalDay(new Date(h.date)))));

  const teacherMap = new Map<string, { id: string; firstName: string; lastName: string }>();
  for (const sl of calendarSlots) {
    const tid = sl.teacherUserId;
    if (!teacherMap.has(tid) && sl.teacher) {
      teacherMap.set(tid, {
        id: tid,
        firstName: sl.teacher.firstName,
        lastName: sl.teacher.lastName,
      });
    }
  }
  const taIds = [
    ...new Set(
      sessions.map((s) => s.teacherAttendance?.teacherUserId).filter((x): x is string => Boolean(x))
    ),
  ].filter((id) => !teacherMap.has(id));
  if (taIds.length > 0) {
    const users = await db.user.findMany({
      where: { id: { in: taIds } },
      select: { id: true, firstName: true, lastName: true },
    });
    for (const u of users) {
      teacherMap.set(u.id, { id: u.id, firstName: u.firstName, lastName: u.lastName });
    }
  }

  const teacherFooterRows: TeacherFooterRow[] = [...teacherMap.values()]
    .sort((a, b) => a.lastName.localeCompare(b.lastName) || a.firstName.localeCompare(b.firstName))
    .map((teacher) => {
      const byDate: Record<string, { hours: number; attendance: string }> = {};
      for (const ymd of dateKeys) {
        const daySlots = calendarSlots.filter((sl) => {
          if (sl.teacherUserId !== teacher.id) return false;
          return formatYmd(startOfLocalDay(new Date(sl.slotDate))) === ymd;
        });
        const sessionSlots = daySlots.filter((sl) => sl.slotType === "SESSION");
        const sessionSlotsForSubject = sessionSlots.filter(
          (sl) => sl.subjectId == null || sl.subjectId === subjectId
        );
        let hours = 0;
        for (const sl of sessionSlotsForSubject) {
          hours += slotDurationMinutes(sl.startTime, sl.endTime) / 60;
        }
        const sess = sessionByYmd.get(ymd);
        if (
          hours === 0 &&
          sess?.startTime &&
          sess?.endTime &&
          sess.teacherAttendance?.teacherUserId === teacher.id
        ) {
          hours = slotDurationMinutes(sess.startTime, sess.endTime) / 60;
        }
        let attendance = "—";
        if (sess?.teacherAttendance?.teacherUserId === teacher.id) {
          attendance = teacherSelfAttendanceShort(sess.teacherAttendance.status);
        }
        byDate[ymd] = {
          hours: Math.round(hours * 10) / 10,
          attendance,
        };
      }
      return {
        teacherId: teacher.id,
        firstName: teacher.firstName,
        lastName: teacher.lastName,
        byDate,
      };
    });

  // Fetch teachers assigned to this batch (via TeacherSubjectAssignment or TeacherProgram)
  const assignedTeacherRows = await db.teacherSubjectAssignment.findMany({
    where: { batchId },
    select: {
      teacherProfile: {
        select: { user: { select: { id: true, firstName: true, lastName: true } } },
      },
    },
  });
  const assignedMap = new Map<string, { id: string; firstName: string; lastName: string }>();
  for (const r of assignedTeacherRows) {
    const u = r.teacherProfile.user;
    assignedMap.set(u.id, u);
  }
  if (assignedMap.size === 0) {
    const programTeachers = await db.teacherProgram.findMany({
      where: { programId: batch.programId },
      select: {
        teacherProfile: {
          select: { user: { select: { id: true, firstName: true, lastName: true } } },
        },
      },
    });
    for (const r of programTeachers) {
      const u = r.teacherProfile.user;
      assignedMap.set(u.id, u);
    }
  }
  const assignedTeachers = [...assignedMap.values()].sort(
    (a, b) => a.firstName.localeCompare(b.firstName) || a.lastName.localeCompare(b.lastName),
  );

  return {
    batch: {
      id: batch.id,
      name: batch.name,
      startDate: batch.startDate.toISOString(),
      endDate: batch.endDate.toISOString(),
      program: { id: batch.program.id, name: batch.program.name, code: batch.program.code },
      academicYear: {
        id: batch.academicYear.id,
        name: batch.academicYear.name,
      },
    },
    students,
    dateKeys,
    cells,
    holidayYmds: [...holidayYmds],
    dateMeta,
    subjectName: subject?.name ?? "",
    gridTruncated,
    teacherFooterRows,
    assignedTeachers,
  };
}

export async function saveAttendanceGridCells(params: {
  batchId: string;
  subjectId: string;
  createdById: string;
  changes: { date: string; studentId: string; letter: string }[];
  /**
   * When a teacher saves attendance via the program sheet, pass their userId
   * so the system auto-marks them PRESENT for each touched session.
   * Leave undefined for principal edits (principal is not the class teacher).
   */
  autoMarkTeacherId?: string;
  /** Default start/end time for newly-created sessions (from the grid UI). */
  defaultStartTime?: string;
  defaultEndTime?: string;
}) {
  const { batchId, subjectId, createdById, changes, autoMarkTeacherId, defaultStartTime, defaultEndTime } = params;
  const studentIds = new Set<string>();
  const touchedSessionIds = new Set<string>();

  for (const ch of changes) {
    const d = new Date(ch.date + "T12:00:00");
    const start = startOfLocalDay(d);
    const end = endOfLocalDay(d);

    let session = await db.attendanceSession.findFirst({
      where: {
        subjectId,
        batchId,
        sessionDate: { gte: start, lte: end },
      },
    });

    const status = displayToStatus(ch.letter);
    if (!status) {
      if (session) {
        await db.attendanceRecord.deleteMany({
          where: { attendanceSessionId: session.id, studentId: ch.studentId },
        });
        studentIds.add(ch.studentId);
        touchedSessionIds.add(session.id);
      }
      continue;
    }

    if (!session) {
      // Try to pick up startTime/endTime from a ProgramCalendarSlot for this date
      let slotStart = defaultStartTime || null;
      let slotEnd = defaultEndTime || null;
      const calSlot = await db.programCalendarSlot.findFirst({
        where: {
          batchId,
          slotDate: { gte: start, lte: end },
          slotType: "SESSION",
          OR: [{ subjectId }, { subjectId: null }],
        },
        select: { startTime: true, endTime: true },
        orderBy: { startTime: "asc" },
      });
      if (calSlot) {
        slotStart = calSlot.startTime;
        slotEnd = calSlot.endTime;
      }

      session = await db.attendanceSession.create({
        data: {
          subjectId,
          batchId,
          sessionDate: start,
          createdById,
          startTime: slotStart,
          endTime: slotEnd,
        },
      });
    } else if (!session.startTime || !session.endTime) {
      // Existing session missing times — backfill from calendar slot or defaults
      let slotStart = defaultStartTime || null;
      let slotEnd = defaultEndTime || null;
      const calSlot = await db.programCalendarSlot.findFirst({
        where: {
          batchId,
          slotDate: { gte: start, lte: end },
          slotType: "SESSION",
          OR: [{ subjectId }, { subjectId: null }],
        },
        select: { startTime: true, endTime: true },
        orderBy: { startTime: "asc" },
      });
      if (calSlot) {
        slotStart = calSlot.startTime;
        slotEnd = calSlot.endTime;
      }
      if (slotStart && slotEnd) {
        await db.attendanceSession.update({
          where: { id: session.id },
          data: { startTime: slotStart, endTime: slotEnd },
        });
        session = { ...session, startTime: slotStart, endTime: slotEnd };
      }
    }

    await db.attendanceRecord.upsert({
      where: {
        attendanceSessionId_studentId: {
          attendanceSessionId: session.id,
          studentId: ch.studentId,
        },
      },
      create: {
        attendanceSessionId: session.id,
        studentId: ch.studentId,
        status,
      },
      update: { status },
    });
    studentIds.add(ch.studentId);
    touchedSessionIds.add(session.id);
  }

  // Auto-mark teacher attendance as PRESENT for every session they touched
  // (only when a teacher is saving — not for principal edits).
  if (autoMarkTeacherId) {
    for (const sessionId of touchedSessionIds) {
      const hasStudentRecords = await db.attendanceRecord.count({
        where: { attendanceSessionId: sessionId },
      });
      if (hasStudentRecords === 0) continue;

      await db.teacherAttendance.upsert({
        where: { attendanceSessionId: sessionId },
        create: {
          attendanceSessionId: sessionId,
          teacherUserId: autoMarkTeacherId,
          status: "PRESENT",
        },
        update: {},
      });
    }
  }

  return { updatedStudents: [...studentIds] };
}
