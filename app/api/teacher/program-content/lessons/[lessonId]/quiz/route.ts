import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { hasTeacherPortalAccess } from "@/lib/portal-access";
import { staffCanAccessProgram } from "@/lib/program-content";
import { NextResponse } from "next/server";

export const runtime = "nodejs";

type QuizOption = { text: string; isCorrect: boolean };
type QuizQuestion = {
  id: string;
  type: "MCQ" | "MULTI_SELECT" | "SHORT" | "PARAGRAPH";
  text: string;
  marks: number;
  options: QuizOption[];
  correctAnswer: string;
  maxLength: number;
  additionalInfo: string;
};

/** Map lesson quiz question type to Assessment QuestionType */
function toAssessmentType(t: QuizQuestion["type"]): "MCQ" | "SHORT" | "PARAGRAPH" {
  if (t === "MCQ" || t === "MULTI_SELECT") return "MCQ";
  if (t === "SHORT") return "SHORT";
  return "PARAGRAPH";
}

async function assertAccess(sessionUserId: string, lessonId: string, session: Parameters<typeof staffCanAccessProgram>[1]) {
  const lesson = await db.programLesson.findUnique({
    where: { id: lessonId },
    include: { chapter: { include: { subject: true } } },
  });
  if (!lesson) return { error: "Not found" as const };
  const can = await staffCanAccessProgram(sessionUserId, session, lesson.chapter.subject.programId);
  if (!can) return { error: "Forbidden" as const };
  return { lesson };
}

export async function POST(req: Request, { params }: { params: Promise<{ lessonId: string }> }) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!hasTeacherPortalAccess(session)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { lessonId } = await params;
  const a = await assertAccess(session.user.id, lessonId, session);
  if ("error" in a) return NextResponse.json({ error: a.error }, { status: a.error === "Not found" ? 404 : 403 });

  const body = (await req.json()) as {
    title: string;
    questions: QuizQuestion[];
    isDraft: boolean;
    passingMarks?: number;
    duration?: number;
    instructions?: string;
  };

  const { lesson } = a;
  const subject = lesson.chapter.subject;
  const programId = subject.programId;

  // Get all active batches for this program
  const batches = await db.batch.findMany({
    where: { programId, isActive: true },
    orderBy: { createdAt: "desc" },
  });

  if (batches.length === 0) {
    // No batch: save questions to content only, no assessment created
    const content = (lesson.content as Record<string, unknown>) ?? {};
    await db.programLesson.update({
      where: { id: lessonId },
      data: {
        title: body.title?.trim() || lesson.title,
        isDraft: body.isDraft,
        content: { ...content, questions: body.questions, assessmentIds: [] },
      },
    });
    return NextResponse.json({ assessmentIds: [], warning: "No active batch found — quiz saved without assessment link." });
  }

  const totalMarks = body.questions.reduce((s, q) => s + (q.marks || 1), 0);
  const assessmentStatus = body.isDraft ? "DRAFT" : "PUBLISHED";
  const assessmentIds: string[] = [];

  // Get existing assessmentIds from lesson content (for update vs create)
  const existingContent = (lesson.content as Record<string, unknown>) ?? {};
  const existingIds: string[] = Array.isArray(existingContent.assessmentIds)
    ? (existingContent.assessmentIds as string[])
    : lesson.assessmentId
    ? [lesson.assessmentId]
    : [];

  for (let i = 0; i < batches.length; i++) {
    const batch = batches[i];
    const existingId = existingIds[i] ?? null;

    const questionData = body.questions.map((q, idx) => ({
      type: toAssessmentType(q.type),
      questionText: q.text || "Untitled question",
      marks: q.marks || 1,
      orderIndex: idx,
      correctAnswer: q.correctAnswer || null,
      maxLength: q.type === "PARAGRAPH" ? (q.maxLength || 2000) : q.type === "SHORT" ? (q.maxLength || 500) : null,
      additionalInfo: q.additionalInfo || null,
      options: {
        create: (q.options || []).map((o, oIdx) => ({
          optionText: o.text,
          isCorrect: o.isCorrect,
          orderIndex: oIdx,
        })),
      },
    }));

    let assessmentId: string;

    if (existingId) {
      // Update existing assessment
      await db.question.deleteMany({ where: { assessmentId: existingId } });
      const updated = await db.assessment.update({
        where: { id: existingId },
        data: {
          title: body.title?.trim() || lesson.title,
          type: "QUIZ",
          status: assessmentStatus,
          totalMarks,
          passingMarks: body.passingMarks ?? null,
          duration: body.duration ?? null,
          instructions: body.instructions ?? null,
          questions: { create: questionData },
        },
      });
      assessmentId = updated.id;
    } else {
      // Create new assessment for this batch
      const created = await db.assessment.create({
        data: {
          title: body.title?.trim() || lesson.title,
          type: "QUIZ",
          status: assessmentStatus,
          subjectId: subject.id,
          batchId: batch.id,
          createdById: session.user.id,
          totalMarks,
          passingMarks: body.passingMarks ?? null,
          duration: body.duration ?? null,
          instructions: body.instructions ?? null,
          questions: { create: questionData },
        },
      });
      assessmentId = created.id;

      // Assign all students in this batch to the assessment
      const students = await db.studentProfile.findMany({
        where: { batchId: batch.id },
        select: { userId: true },
      });
      if (students.length > 0) {
        await db.assessmentAssignedStudent.createMany({
          data: students.map((s) => ({ assessmentId, studentId: s.userId })),
          skipDuplicates: true,
        });
      }
    }

    assessmentIds.push(assessmentId);
  }

  // Update lesson with assessmentId (first batch) and all ids in content
  await db.programLesson.update({
    where: { id: lessonId },
    data: {
      title: body.title?.trim() || lesson.title,
      isDraft: body.isDraft,
      assessmentId: assessmentIds[0] ?? null,
      content: {
        ...existingContent,
        questions: body.questions,
        assessmentIds,
      },
    },
  });

  return NextResponse.json({ assessmentIds, primaryAssessmentId: assessmentIds[0] });
}
