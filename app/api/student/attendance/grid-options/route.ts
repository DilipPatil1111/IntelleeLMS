import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { hasStudentPortalAccess } from "@/lib/portal-access";
import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";

/** Subjects for the student's program + batch id (for attendance sheet grid).
 *  Accepts optional ?programId= to return subjects/batch for a specific enrolled program. */
export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!hasStudentPortalAccess(session)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const requestedProgramId = req.nextUrl.searchParams.get("programId");

  const profile = await db.studentProfile.findUnique({
    where: { userId: session.user.id },
    include: { program: true, batch: true },
  });

  let targetProgramId: string | null = null;
  let targetBatchId: string | null = null;
  let targetProgramName: string | null = null;
  let targetBatchName: string | null = null;

  if (requestedProgramId) {
    const enrollment = await db.programEnrollment.findUnique({
      where: { userId_programId: { userId: session.user.id, programId: requestedProgramId } },
      include: {
        program: { select: { id: true, name: true } },
        batch: { select: { id: true, name: true } },
      },
    });
    if (enrollment) {
      targetProgramId = enrollment.programId;
      targetBatchId = enrollment.batchId;
      targetProgramName = enrollment.program.name;
      targetBatchName = enrollment.batch?.name ?? null;
    } else if (profile?.programId === requestedProgramId) {
      targetProgramId = profile.programId;
      targetBatchId = profile.batchId;
      targetProgramName = profile.program?.name ?? null;
      targetBatchName = profile.batch?.name ?? null;
    }
  } else {
    targetProgramId = profile?.programId ?? null;
    targetBatchId = profile?.batchId ?? null;
    targetProgramName = profile?.program?.name ?? null;
    targetBatchName = profile?.batch?.name ?? null;
  }

  if (!targetProgramId || !targetBatchId) {
    return NextResponse.json({ batchId: null, subjects: [], programName: null, batchName: null });
  }

  const subjects = await db.subject.findMany({
    where: { programId: targetProgramId },
    select: { id: true, name: true },
    orderBy: { name: "asc" },
  });

  return NextResponse.json({
    batchId: targetBatchId,
    programName: targetProgramName,
    batchName: targetBatchName,
    subjects: subjects.map((s) => ({ id: s.id, name: s.name })),
  });
}
