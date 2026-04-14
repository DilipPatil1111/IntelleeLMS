import { requireTeacherPortal } from "@/lib/api-auth";
import { db } from "@/lib/db";
import { isTeacherOwnershipRestricted } from "@/lib/portal-access";
import { NextResponse } from "next/server";

const richInclude = {
  programDomain: { select: { id: true, name: true } },
  programCategory: { select: { id: true, name: true } },
  programType: { select: { id: true, name: true } },
  _count: { select: { subjects: true, batches: true, students: true } },
  programSyllabus: { select: { isPublished: true } },
} as const;

export async function GET() {
  const gate = await requireTeacherPortal();
  if (!gate.ok) return gate.response;
  const session = gate.session;

  let programIds: string[] | null = null;

  if (isTeacherOwnershipRestricted(session)) {
    const profile = await db.teacherProfile.findUnique({
      where: { userId: session.user.id },
      select: { teacherPrograms: { select: { programId: true } } },
    });
    programIds = profile?.teacherPrograms.map((tp) => tp.programId) ?? [];
  }

  const programs = await db.program.findMany({
    where: programIds ? { id: { in: programIds } } : { isActive: true },
    include: richInclude,
    orderBy: { name: "asc" },
  });

  const mapped = programs.map((p) => ({
    id: p.id,
    name: p.name,
    code: p.code,
    description: p.description,
    durationText: p.durationText,
    programDomain: p.programDomain,
    programCategory: p.programCategory,
    programType: p.programType,
    _count: p._count,
    isPublished: p.programSyllabus?.isPublished ?? false,
  }));

  return NextResponse.json({
    programs: mapped.map((p) => ({ value: p.id, label: p.name })),
    raw: mapped,
  });
}
