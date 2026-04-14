import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { hasStudentPortalAccess } from "@/lib/portal-access";
import { NextResponse } from "next/server";

export const runtime = "nodejs";

/**
 * Student marks an entire chapter complete — all non-QUIZ, non-draft lessons
 * within that chapter are recorded as completed for this student.
 */
export async function POST(_req: Request, { params }: { params: Promise<{ chapterId: string }> }) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!hasStudentPortalAccess(session)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { chapterId } = await params;

  const chapter = await db.programChapter.findUnique({
    where: { id: chapterId },
    include: {
      subject: true,
      lessons: { where: { isDraft: false, kind: { not: "QUIZ" } } },
    },
  });
  if (!chapter) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const programId = chapter.subject.programId;

  const enrollment = await db.programEnrollment.findUnique({
    where: { userId_programId: { userId: session.user.id, programId } },
  });
  if (!enrollment) {
    const profile = await db.studentProfile.findUnique({
      where: { userId: session.user.id },
      select: { programId: true },
    });
    if (!profile?.programId || profile.programId !== programId) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
  }

  const syllabus = await db.programSyllabus.findUnique({ where: { programId } });
  if (!syllabus?.isPublished) {
    return NextResponse.json({ error: "Program content not published" }, { status: 403 });
  }

  let marked = 0;
  for (const lesson of chapter.lessons) {
    await db.programLessonCompletion.upsert({
      where: { studentUserId_lessonId: { studentUserId: session.user.id, lessonId: lesson.id } },
      create: { studentUserId: session.user.id, lessonId: lesson.id },
      update: {},
    });
    marked++;
  }

  return NextResponse.json({ ok: true, lessonsMarked: marked });
}
