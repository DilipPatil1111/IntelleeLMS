import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { hasStudentPortalAccess } from "@/lib/portal-access";
import { fetchProgramContentTree, getOrCreateProgramSyllabus } from "@/lib/program-content";
import { NextResponse } from "next/server";

export const runtime = "nodejs";

export async function GET(_req: Request, { params }: { params: Promise<{ programId: string }> }) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!hasStudentPortalAccess(session)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { programId } = await params;

  // Validate the student is enrolled in this program via ProgramEnrollment or legacy StudentProfile
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

  await getOrCreateProgramSyllabus(programId);
  const program = await fetchProgramContentTree(programId);

  const syllabus = program?.programSyllabus;
  if (!program || !syllabus?.isPublished) {
    return NextResponse.json({
      program: null,
      syllabusPublished: false,
      message: "Program content is not published yet.",
    });
  }

  // Collect all assessmentIds from quiz lessons to batch-check their status
  const allLessons = program.subjects
    .flatMap((s) => s.programChapters)
    .flatMap((ch) => ch.lessons);

  const quizAssessmentIds = allLessons
    .filter((l) => l.kind === "QUIZ" && l.assessmentId)
    .map((l) => l.assessmentId as string);

  const assessmentStatusMap = new Map<string, string>();
  if (quizAssessmentIds.length > 0) {
    const assessments = await db.assessment.findMany({
      where: { id: { in: quizAssessmentIds } },
      select: { id: true, status: true },
    });
    for (const a of assessments) {
      assessmentStatusMap.set(a.id, a.status);
    }
  }

  // Fetch student completions
  const completions = await db.programLessonCompletion.findMany({
    where: { studentUserId: session.user.id },
    select: { lessonId: true },
  });
  const completedSet = new Set(completions.map((c) => c.lessonId));

  // Fetch submitted/graded quiz attempts for this student
  const attempts = quizAssessmentIds.length > 0
    ? await db.attempt.findMany({
        where: {
          studentId: session.user.id,
          assessmentId: { in: quizAssessmentIds },
          status: { in: ["SUBMITTED", "GRADED"] },
        },
        select: { assessmentId: true },
      })
    : [];
  const completedAssessmentIds = new Set(attempts.map((a) => a.assessmentId));

  const filtered = {
    ...program,
    subjects: program.subjects.map((s) => ({
      ...s,
      programChapters: s.programChapters.map((ch) => ({
        ...ch,
        lessons: ch.lessons
          .filter((l) => {
            if (l.kind === "QUIZ") {
              if (!l.assessmentId) return false;
              return assessmentStatusMap.get(l.assessmentId) === "PUBLISHED";
            }
            if (l.isDraft) return false;
            return true;
          })
          .map((l) => {
            const isCompleted =
              l.kind === "QUIZ" && l.assessmentId
                ? completedAssessmentIds.has(l.assessmentId)
                : completedSet.has(l.id);
            return { ...l, isCompleted };
          }),
      })),
    })),
  };

  return NextResponse.json({ program: filtered, syllabusPublished: true });
}
