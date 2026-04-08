import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { redirect } from "next/navigation";
import { computeStudentBatchAttendancePercent } from "@/lib/attendance-threshold";
import { AttendancePageClient } from "./attendance-page-client";

export default async function StudentAttendancePage() {
  const session = await auth();
  if (!session?.user) redirect("/login");

  const profile = await db.studentProfile.findUnique({
    where: { userId: session.user.id },
    include: { program: true, batch: true },
  });

  const enrollments = await db.programEnrollment.findMany({
    where: {
      userId: session.user.id,
      status: { in: ["ENROLLED", "COMPLETED", "GRADUATED"] },
    },
    include: {
      program: { select: { id: true, name: true, minAttendancePercent: true } },
      batch: { select: { id: true, name: true } },
    },
  });

  // Build programs list: from enrollments, plus fallback to profile
  const programsMap = new Map<string, { id: string; name: string; batchId: string | null; batchName: string | null; minAttendancePct: number | null }>();
  for (const e of enrollments) {
    programsMap.set(e.programId, {
      id: e.programId,
      name: e.program.name,
      batchId: e.batchId,
      batchName: e.batch?.name ?? null,
      minAttendancePct: e.program.minAttendancePercent,
    });
  }
  if (profile?.programId && !programsMap.has(profile.programId)) {
    programsMap.set(profile.programId, {
      id: profile.programId,
      name: profile.program?.name ?? "Unknown",
      batchId: profile.batchId,
      batchName: profile.batch?.name ?? null,
      minAttendancePct: profile.program?.minAttendancePercent ?? null,
    });
  }

  const programs = Array.from(programsMap.values());
  const defaultProgramId = profile?.programId ?? programs[0]?.id ?? null;

  const inst = await db.institutionSettings.findUnique({ where: { id: 1 } });
  const globalRequiredPct = inst?.minAttendancePercent ?? 75;

  // Fetch ALL records for current user
  const records = await db.attendanceRecord.findMany({
    where: { studentId: session.user.id },
    include: {
      session: { include: { subject: { include: { program: { select: { id: true } } } } } },
    },
    orderBy: { session: { sessionDate: "desc" } },
  });

  // Fetch batch attendance percentages
  const batchPcts: Record<string, number | null> = {};
  for (const prog of programs) {
    if (prog.batchId) {
      batchPcts[prog.id] = await computeStudentBatchAttendancePercent(session.user.id, prog.batchId);
    }
  }

  // Extract unique subjects from records
  const subjectSet = new Map<string, string>();
  for (const r of records) {
    if (r.session?.subject) {
      subjectSet.set(r.session.subject.id ?? "", r.session.subject.name ?? "Unknown");
    }
  }
  const subjects = Array.from(subjectSet, ([id, name]) => ({ id, name }));

  return (
    <AttendancePageClient
      programs={programs}
      defaultProgramId={defaultProgramId}
      globalRequiredPct={globalRequiredPct}
      batchPcts={batchPcts}
      records={JSON.parse(JSON.stringify(records))}
      subjects={subjects}
    />
  );
}
