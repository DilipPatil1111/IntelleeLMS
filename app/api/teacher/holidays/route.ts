import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { hasTeacherPortalAccess } from "@/lib/portal-access";
import { NextResponse } from "next/server";

/**
 * Holiday list for teachers — returns all holidays with program info,
 * optionally filtered by programId query param.
 */
export async function GET(req: Request) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!hasTeacherPortalAccess(session)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { searchParams } = new URL(req.url);
  const years = parseInt(searchParams.get("years") || "2", 10) || 2;
  const programId = searchParams.get("programId") || undefined;

  // Get teacher's programs
  const teacherPrograms = await db.teacherProgram.findMany({
    where: { userId: session.user.id },
    include: { program: { select: { id: true, name: true } } },
  });
  const programs = teacherPrograms.map((tp) => ({ id: tp.program.id, name: tp.program.name }));
  const teacherProgramIds = programs.map((p) => p.id);

  const whereFilter = programId
    ? { OR: [{ programId: null }, { programId }] }
    : teacherProgramIds.length > 0
      ? { OR: [{ programId: null }, { programId: { in: teacherProgramIds } }] }
      : { programId: null };

  const all = await db.holiday.findMany({
    where: whereFilter,
    include: {
      academicYear: { select: { id: true, name: true } },
      program: { select: { id: true, name: true } },
    },
    orderBy: { date: "asc" },
  });

  const now = new Date();
  const cutoff = new Date(now.getFullYear() - years + 1, 0, 1);
  const filtered = all.filter((h) => new Date(h.date) >= cutoff);

  const page = Math.max(1, Number.parseInt(searchParams.get("page") || "1", 10) || 1);
  let pageSize = Number.parseInt(searchParams.get("pageSize") || "10", 10) || 10;
  pageSize = Math.min(Math.max(1, pageSize), 50);
  const total = filtered.length;
  const start = (page - 1) * pageSize;
  const holidays = filtered.slice(start, start + pageSize);

  const publicHolidays = filtered.filter((h) => !h.programId);
  const byProgram: Record<string, typeof filtered> = {};
  for (const h of filtered) {
    if (h.programId) {
      if (!byProgram[h.programId]) byProgram[h.programId] = [];
      byProgram[h.programId].push(h);
    }
  }

  return NextResponse.json({
    holidays,
    total,
    page,
    pageSize,
    publicHolidays,
    byProgram,
    programs,
  });
}
