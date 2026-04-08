import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { hasStudentPortalAccess } from "@/lib/portal-access";
import { NextResponse } from "next/server";

export const runtime = "nodejs";

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!hasStudentPortalAccess(session)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const enrollments = await db.programEnrollment.findMany({
    where: { userId: session.user.id, status: { in: ["ENROLLED", "COMPLETED", "GRADUATED"] } },
    select: { programId: true },
  });

  const enrolledProgramIds = enrollments.map((e) => e.programId);

  // Fallback: also check StudentProfile.programId for legacy records not yet in ProgramEnrollment
  const profile = await db.studentProfile.findUnique({
    where: { userId: session.user.id },
    select: { programId: true, status: true },
  });

  if (
    profile?.programId &&
    ["ENROLLED", "COMPLETED", "GRADUATED"].includes(profile.status ?? "") &&
    !enrolledProgramIds.includes(profile.programId)
  ) {
    enrolledProgramIds.push(profile.programId);
  }

  if (enrolledProgramIds.length === 0) {
    return NextResponse.json({ programs: [] });
  }

  const programs = await db.program.findMany({
    where: { id: { in: enrolledProgramIds } },
    include: {
      programDomain: { select: { id: true, name: true } },
      programCategory: { select: { id: true, name: true } },
      programType: { select: { id: true, name: true } },
      _count: { select: { subjects: true, batches: true, students: true } },
      programSyllabus: { select: { isPublished: true } },
    },
  });

  return NextResponse.json({
    programs: programs.map((program) => ({
      id: program.id,
      name: program.name,
      code: program.code,
      description: program.description,
      durationText: program.durationText,
      programDomain: program.programDomain,
      programCategory: program.programCategory,
      programType: program.programType,
      _count: program._count,
      isPublished: program.programSyllabus?.isPublished ?? false,
    })),
  });
}
