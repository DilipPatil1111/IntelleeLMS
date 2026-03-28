import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { syncAssessmentAssignedStudents } from "@/lib/assessment-assigned-students";
import { NextResponse } from "next/server";

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const newTitle = (body.title as string) || undefined;

  const source = await db.assessment.findUnique({
    where: { id },
    include: {
      assignedStudents: { select: { studentId: true } },
      questions: {
        include: { options: { orderBy: { orderIndex: "asc" } } },
        orderBy: { orderIndex: "asc" },
      },
    },
  });

  if (!source) return NextResponse.json({ error: "Assessment not found" }, { status: 404 });

  const copy = await db.assessment.create({
    data: {
      title: newTitle || `${source.title} (Copy)`,
      description: source.description,
      type: source.type,
      status: "DRAFT",
      subjectId: source.subjectId,
      batchId: source.batchId,
      createdById: session.user.id,
      totalMarks: source.totalMarks,
      passingMarks: source.passingMarks,
      duration: source.duration,
      instructions: source.instructions,
      moduleId: source.moduleId,
      topicId: source.topicId,
      moduleNameText: source.moduleNameText,
      topicNameText: source.topicNameText,
      isMandatory: source.isMandatory,
      questions: {
        create: source.questions.map((q, idx) => ({
          type: q.type,
          questionText: q.questionText,
          marks: q.marks,
          orderIndex: idx,
          correctAnswer: q.correctAnswer,
          rubric: q.rubric,
          maxLength: q.maxLength,
          options: {
            create: q.options.map((o, oIdx) => ({
              optionText: o.optionText,
              isCorrect: o.isCorrect,
              orderIndex: oIdx,
            })),
          },
        })),
      },
    },
  });

  const fromSource = source.assignedStudents.map((a) => a.studentId);
  if (fromSource.length > 0) {
    await syncAssessmentAssignedStudents(copy.id, fromSource);
  } else {
    const inBatch = await db.studentProfile.findMany({
      where: { batchId: copy.batchId },
      select: { userId: true },
    });
    await syncAssessmentAssignedStudents(
      copy.id,
      inBatch.map((p) => p.userId)
    );
  }

  return NextResponse.json({ id: copy.id });
}
