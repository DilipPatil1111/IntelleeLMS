import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { hasTeacherPortalAccess } from "@/lib/portal-access";
import { staffCanAccessProgram } from "@/lib/program-content";
import { NextResponse } from "next/server";

export const runtime = "nodejs";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ chapterId: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!hasTeacherPortalAccess(session)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { chapterId } = await params;

  const chapter = await db.programChapter.findUnique({
    where: { id: chapterId },
    include: { subject: true },
  });
  if (!chapter) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const can = await staffCanAccessProgram(session.user.id, session, chapter.subject.programId);
  if (!can) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  // Fetch all QUIZ assessments belonging to this program's subjects
  const subjects = await db.subject.findMany({
    where: { programId: chapter.subject.programId },
    select: { id: true },
  });
  const subjectIds = subjects.map((s) => s.id);

  const assessments = await db.assessment.findMany({
    where: {
      subjectId: { in: subjectIds },
      type: "QUIZ",
    },
    select: {
      id: true,
      title: true,
      status: true,
      totalMarks: true,
      createdAt: true,
      batch: { select: { name: true } },
      subject: { select: { name: true } },
      _count: { select: { questions: true } },
    },
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json({ assessments });
}
