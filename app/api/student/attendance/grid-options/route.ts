import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { hasStudentPortalAccess } from "@/lib/portal-access";
import { NextResponse } from "next/server";

export const runtime = "nodejs";

/** Subjects for the student’s program + batch id (for attendance sheet grid). */
export async function GET() {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!hasStudentPortalAccess(session)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const profile = await db.studentProfile.findUnique({
    where: { userId: session.user.id },
    include: { program: true, batch: true },
  });
  if (!profile?.batchId || !profile.programId) {
    return NextResponse.json({ batchId: null, subjects: [], programName: null, batchName: null });
  }

  const subjects = await db.subject.findMany({
    where: { programId: profile.programId },
    select: { id: true, name: true },
    orderBy: { name: "asc" },
  });

  return NextResponse.json({
    batchId: profile.batchId,
    programName: profile.program?.name ?? null,
    batchName: profile.batch?.name ?? null,
    subjects: subjects.map((s) => ({ id: s.id, name: s.name })),
  });
}
