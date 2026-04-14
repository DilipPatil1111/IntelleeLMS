import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { hasStudentPortalAccess } from "@/lib/portal-access";
import { NextResponse } from "next/server";

export const runtime = "nodejs";

/**
 * Students can only self-complete SURVEY lessons (by submitting the survey).
 * All other lesson types are marked complete by the assigned Teacher or
 * Principal/Administrator.
 */
export async function POST(_req: Request, { params }: { params: Promise<{ lessonId: string }> }) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!hasStudentPortalAccess(session)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { lessonId } = await params;

  const lesson = await db.programLesson.findUnique({
    where: { id: lessonId },
    include: {
      chapter: { include: { subject: true } },
    },
  });
  if (!lesson) return NextResponse.json({ error: "Not found" }, { status: 404 });

  if (lesson.kind === "QUIZ") {
    return NextResponse.json({ error: "Complete the quiz from Assessments" }, { status: 400 });
  }

  if (lesson.kind !== "SURVEY") {
    return NextResponse.json(
      { error: "Lessons are marked complete by your Teacher or Principal" },
      { status: 403 },
    );
  }

  const profile = await db.studentProfile.findUnique({
    where: { userId: session.user.id },
  });
  if (!profile?.programId || profile.programId !== lesson.chapter.subject.programId) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const syllabus = await db.programSyllabus.findUnique({
    where: { programId: lesson.chapter.subject.programId },
  });
  if (!syllabus?.isPublished) {
    return NextResponse.json({ error: "Not available" }, { status: 403 });
  }

  if (lesson.isDraft) {
    return NextResponse.json({ error: "Lesson not available" }, { status: 400 });
  }

  await db.programLessonCompletion.upsert({
    where: {
      studentUserId_lessonId: {
        studentUserId: session.user.id,
        lessonId,
      },
    },
    create: {
      studentUserId: session.user.id,
      lessonId,
    },
    update: {},
  });

  return NextResponse.json({ ok: true });
}
