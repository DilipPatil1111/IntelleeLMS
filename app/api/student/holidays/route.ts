import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { hasStudentPortalAccess } from "@/lib/portal-access";
import { NextResponse } from "next/server";

/**
 * Holidays for the student, organized program-wise.
 * Returns public holidays (no programId) + custom holidays for each enrolled program.
 */
export async function GET(_req: Request) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!hasStudentPortalAccess(session)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const profile = await db.studentProfile.findUnique({
    where: { userId: session.user.id },
    include: { batch: { select: { academicYearId: true } } },
  });
  const ayId = profile?.batch?.academicYearId;

  // Get all enrolled programs
  const enrollments = await db.programEnrollment.findMany({
    where: {
      userId: session.user.id,
      status: { in: ["ENROLLED", "COMPLETED", "GRADUATED"] },
    },
    include: { program: { select: { id: true, name: true } } },
  });

  const programIds = enrollments.map((e) => e.programId);
  if (profile?.programId && !programIds.includes(profile.programId)) {
    programIds.push(profile.programId);
  }

  // Fetch holidays: global (no programId) within academic year + program-specific
  const whereClause = ayId
    ? {
        OR: [
          { academicYearId: ayId, programId: null },
          ...(programIds.length > 0 ? [{ programId: { in: programIds } }] : []),
        ],
      }
    : programIds.length > 0
      ? { OR: [{ programId: null }, { programId: { in: programIds } }] }
      : { programId: null };

  const holidays = await db.holiday.findMany({
    where: whereClause,
    include: {
      academicYear: { select: { id: true, name: true } },
      program: { select: { id: true, name: true } },
    },
    orderBy: { date: "asc" },
  });

  // Group by program for the UI
  const programs = enrollments.map((e) => ({
    id: e.program.id,
    name: e.program.name,
  }));

  // Public/global holidays (no program)
  const publicHolidays = holidays.filter((h) => !h.programId);
  // Program-specific holidays grouped
  const byProgram: Record<string, typeof holidays> = {};
  for (const h of holidays) {
    if (h.programId) {
      if (!byProgram[h.programId]) byProgram[h.programId] = [];
      byProgram[h.programId].push(h);
    }
  }

  return NextResponse.json({
    holidays,
    publicHolidays,
    byProgram,
    programs,
  });
}
