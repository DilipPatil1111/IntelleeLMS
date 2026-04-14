import { requirePrincipalPortal } from "@/lib/api-auth";
import { db } from "@/lib/db";
import { NextResponse } from "next/server";

export async function GET(req: Request) {
  const gate = await requirePrincipalPortal();
  if (!gate.ok) return gate.response;
  const session = gate.session;

  const { searchParams } = new URL(req.url);
  const programId = searchParams.get("programId");
  const batchId = searchParams.get("batchId");
  const academicYearId = searchParams.get("academicYearId");

  const studentWhere: Record<string, unknown> = {};
  if (batchId) studentWhere.batchId = batchId;
  else if (programId) studentWhere.programId = programId;
  if (academicYearId && !batchId) studentWhere.batch = { academicYearId };

  const profiles = await db.studentProfile.findMany({
    where: studentWhere,
    include: { program: true, batch: { include: { academicYear: true } } },
  });

  const byStatus: Record<string, number> = {};
  for (const s of profiles) {
    const k = s.status;
    byStatus[k] = (byStatus[k] || 0) + 1;
  }

  const enrollmentByProgram: { programId: string; programName: string; count: number }[] = [];
  const pmap = new Map<string, { programId: string; programName: string; count: number }>();
  for (const p of profiles) {
    if (!p.programId || !p.program) continue;
    const cur = pmap.get(p.programId) || {
      programId: p.programId,
      programName: p.program.name,
      count: 0,
    };
    cur.count += 1;
    pmap.set(p.programId, cur);
  }
  enrollmentByProgram.push(...pmap.values());

  const enrollmentByBatch = new Map<string, number>();
  for (const p of profiles) {
    if (!p.batchId) continue;
    enrollmentByBatch.set(p.batchId, (enrollmentByBatch.get(p.batchId) || 0) + 1);
  }

  const teachers = await db.user.findMany({
    where: { role: "TEACHER", isActive: true },
    include: {
      teacherProfile: { include: { teacherPrograms: { include: { program: true } } } },
    },
  });

  let teachersFiltered = teachers;
  if (programId) {
    teachersFiltered = teachers.filter((t) =>
      t.teacherProfile?.teacherPrograms.some((tp) => tp.programId === programId)
    );
  }

  const teacherCountByProgram: { programId: string; name: string; count: number }[] = [];
  const tmap = new Map<string, { programId: string; name: string; count: number }>();
  for (const t of teachers) {
    for (const tp of t.teacherProfile?.teacherPrograms || []) {
      const cur = tmap.get(tp.programId) || { programId: tp.programId, name: tp.program.name, count: 0 };
      cur.count += 1;
      tmap.set(tp.programId, cur);
    }
  }
  teacherCountByProgram.push(...tmap.values());

  return NextResponse.json({
    totalStudents: profiles.length,
    studentsByStatus: byStatus,
    enrollmentByProgram,
    enrollmentByBatch: [...enrollmentByBatch.entries()].map(([batchId, count]) => ({ batchId, count })),
    totalTeachers: teachersFiltered.length,
    teacherCountByProgram,
  });
}
