import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { hasPrincipalPortalAccess } from "@/lib/portal-access";
import { endOfLocalDay, formatYmd, startOfLocalDay } from "@/lib/day-boundaries";
import { slotDurationMinutes } from "@/lib/program-calendar-hours";
import type { AttendanceStatus } from "@/app/generated/prisma/enums";
import type { Prisma } from "@/app/generated/prisma/client";
import { NextResponse } from "next/server";

export const runtime = "nodejs";

function ratePct(present: number, absent: number, late: number, excused: number): number | null {
  const t = present + absent + late + excused;
  if (t === 0) return null;
  return Math.round(((present + late * 0.5) / t) * 1000) / 10;
}

export async function GET(req: Request) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!hasPrincipalPortalAccess(session)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { searchParams } = new URL(req.url);
  const programId = searchParams.get("programId")?.trim() || "";
  const batchId = searchParams.get("batchId")?.trim() || "";
  const from = searchParams.get("from")?.trim() || "";
  const to = searchParams.get("to")?.trim() || "";

  const sessionWhere: Prisma.AttendanceSessionWhereInput = {};
  if (batchId) sessionWhere.batchId = batchId;
  if (programId) sessionWhere.batch = { programId };
  if (from && to) {
    sessionWhere.sessionDate = {
      gte: startOfLocalDay(new Date(from)),
      lte: endOfLocalDay(new Date(to)),
    };
  } else if (from) {
    sessionWhere.sessionDate = { gte: startOfLocalDay(new Date(from)) };
  } else if (to) {
    sessionWhere.sessionDate = { lte: endOfLocalDay(new Date(to)) };
  }

  const sessions = await db.attendanceSession.findMany({
    where: sessionWhere,
    include: {
      subject: { select: { id: true, name: true } },
      batch: { include: { program: { select: { id: true, name: true } } } },
      records: {
        include: { student: { select: { id: true, firstName: true, lastName: true } } },
      },
      teacherAttendance: {
        include: { teacher: { select: { id: true, firstName: true, lastName: true, email: true } } },
      },
    },
    orderBy: { sessionDate: "desc" },
    take: 4000,
  });

  let presentAll = 0;
  let absentAll = 0;
  let lateAll = 0;
  let excusedAll = 0;
  let teacherPresentHours = 0;

  type ProgAgg = {
    programId: string;
    programName: string;
    sessions: number;
    studentAttendanceCount: number;
    present: number;
    absent: number;
    late: number;
    excused: number;
  };
  type BatchAgg = {
    batchId: string;
    batchName: string;
    programName: string;
    sessions: number;
    studentAttendanceCount: number;
    present: number;
    absent: number;
    late: number;
    excused: number;
  };
  type StuAgg = {
    studentId: string;
    name: string;
    batchName: string;
    programName: string;
    present: number;
    absent: number;
    late: number;
    excused: number;
    totalSessions: number;
    presentHours: number;
  };
  type TeachAgg = {
    teacherId: string;
    name: string;
    sessionsRecorded: number;
    present: number;
    absent: number;
    late: number;
    excused: number;
    presentHours: number;
  };

  const programMap = new Map<string, ProgAgg>();
  const batchMap = new Map<string, BatchAgg>();
  const studentMap = new Map<string, StuAgg>();
  const teacherMap = new Map<string, TeachAgg>();

  const bump = (st: AttendanceStatus) => {
    if (st === "PRESENT") presentAll += 1;
    else if (st === "ABSENT") absentAll += 1;
    else if (st === "LATE") lateAll += 1;
    else if (st === "EXCUSED") excusedAll += 1;
  };

  for (const s of sessions) {
    const pid = s.batch.program.id;
    const pname = s.batch.program.name;
    const bid = s.batchId;
    const bname = s.batch.name;

    if (!programMap.has(pid)) {
      programMap.set(pid, {
        programId: pid,
        programName: pname,
        sessions: 0,
        studentAttendanceCount: 0,
        present: 0,
        absent: 0,
        late: 0,
        excused: 0,
      });
    }
    if (!batchMap.has(bid)) {
      batchMap.set(bid, {
        batchId: bid,
        batchName: bname,
        programName: pname,
        sessions: 0,
        studentAttendanceCount: 0,
        present: 0,
        absent: 0,
        late: 0,
        excused: 0,
      });
    }
    const pg = programMap.get(pid)!;
    const bg = batchMap.get(bid)!;
    pg.sessions += 1;
    bg.sessions += 1;

    for (const r of s.records) {
      pg.studentAttendanceCount += 1;
      bg.studentAttendanceCount += 1;
      bump(r.status);
      const pk = r.studentId;
      const stu = r.student;
      const name = `${stu.firstName} ${stu.lastName}`.trim();
      if (!studentMap.has(pk)) {
        studentMap.set(pk, {
          studentId: pk,
          name,
          batchName: bname,
          programName: pname,
          present: 0,
          absent: 0,
          late: 0,
          excused: 0,
          totalSessions: 0,
          presentHours: 0,
        });
      }
      const sg = studentMap.get(pk)!;
      sg.totalSessions += 1;
      if (r.status === "PRESENT" || r.status === "LATE") {
        const mins = slotDurationMinutes(s.startTime, s.endTime);
        if (mins > 0) sg.presentHours += mins / 60;
      }
      if (r.status === "PRESENT") {
        sg.present += 1;
        pg.present += 1;
        bg.present += 1;
      } else if (r.status === "ABSENT") {
        sg.absent += 1;
        pg.absent += 1;
        bg.absent += 1;
      } else if (r.status === "LATE") {
        sg.late += 1;
        pg.late += 1;
        bg.late += 1;
      } else if (r.status === "EXCUSED") {
        sg.excused += 1;
        pg.excused += 1;
        bg.excused += 1;
      }
    }

    const ta = s.teacherAttendance;
    if (ta) {
      const tid = ta.teacherUserId;
      const tn = `${ta.teacher.firstName} ${ta.teacher.lastName}`.trim();
      if (!teacherMap.has(tid)) {
        teacherMap.set(tid, {
          teacherId: tid,
          name: tn,
          sessionsRecorded: 0,
          present: 0,
          absent: 0,
          late: 0,
          excused: 0,
          presentHours: 0,
        });
      }
      const tg = teacherMap.get(tid)!;
      tg.sessionsRecorded += 1;
      if (ta.status === "PRESENT") tg.present += 1;
      else if (ta.status === "ABSENT") tg.absent += 1;
      else if (ta.status === "LATE") tg.late += 1;
      else if (ta.status === "EXCUSED") tg.excused += 1;
      if (ta.status === "PRESENT" || ta.status === "LATE") {
        const m = slotDurationMinutes(s.startTime, s.endTime);
        if (m > 0) tg.presentHours += m / 60;
      }
    }
  }

  for (const tg of teacherMap.values()) {
    tg.presentHours = Math.round(tg.presentHours * 10) / 10;
    teacherPresentHours += tg.presentHours;
  }
  teacherPresentHours = Math.round(teacherPresentHours * 10) / 10;

  const summary = {
    totalSessions: sessions.length,
    totalStudentAttendance: presentAll + absentAll + lateAll + excusedAll,
    presentCount: presentAll,
    absentCount: absentAll,
    lateCount: lateAll,
    excusedCount: excusedAll,
    attendanceRatePercent: ratePct(presentAll, absentAll, lateAll, excusedAll),
    teacherPresentHours,
  };

  const byProgram = [...programMap.values()]
    .map((r) => ({
      ...r,
      rate: ratePct(r.present, r.absent, r.late, r.excused),
    }))
    .sort((a, b) => a.programName.localeCompare(b.programName));

  const byBatch = [...batchMap.values()]
    .map((r) => ({
      ...r,
      rate: ratePct(r.present, r.absent, r.late, r.excused),
    }))
    .sort((a, b) => a.programName.localeCompare(b.programName) || a.batchName.localeCompare(b.batchName));

  for (const sg of studentMap.values()) {
    sg.presentHours = Math.round(sg.presentHours * 10) / 10;
  }

  const byStudent = [...studentMap.values()]
    .map((r) => ({
      ...r,
      rate: ratePct(r.present, r.absent, r.late, r.excused),
    }))
    .sort((a, b) => a.name.localeCompare(b.name));

  const byTeacher = [...teacherMap.values()].sort((a, b) => a.name.localeCompare(b.name));

  const sessionRows = sessions.slice(0, 300).map((s) => ({
    id: s.id,
    sessionDate: formatYmd(startOfLocalDay(new Date(s.sessionDate))),
    startTime: s.startTime,
    endTime: s.endTime,
    topic: s.topic,
    overrideHoliday: s.overrideHoliday,
    subject: s.subject,
    batch: { id: s.batchId, name: s.batch.name, program: s.batch.program },
    createdById: s.createdById,
    records: s.records.map((r) => ({
      id: r.id,
      studentId: r.studentId,
      studentName: `${r.student.firstName} ${r.student.lastName}`.trim(),
      status: r.status,
    })),
    teacherAttendance: s.teacherAttendance
      ? {
          id: s.teacherAttendance.id,
          teacherUserId: s.teacherAttendance.teacherUserId,
          status: s.teacherAttendance.status,
          teacherName: `${s.teacherAttendance.teacher.firstName} ${s.teacherAttendance.teacher.lastName}`.trim(),
        }
      : null,
  }));

  return NextResponse.json({
    filters: { programId: programId || null, batchId: batchId || null, from: from || null, to: to || null },
    summary,
    byProgram,
    byBatch,
    byStudent,
    byTeacher,
    sessions: sessionRows,
  });
}
