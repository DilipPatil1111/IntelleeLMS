import { requireTeacherPortal } from "@/lib/api-auth";
import { db } from "@/lib/db";
import { isTeacherOwnershipRestricted } from "@/lib/portal-access";
import { syncAssessmentAssignedStudents } from "@/lib/assessment-assigned-students";
import { NextResponse } from "next/server";

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const gate = await requireTeacherPortal();
  if (!gate.ok) return gate.response;
  const session = gate.session;

  const body = await req.json().catch(() => ({}));
  const newTitle = (body.title as string) || undefined;

  try {
    const source = await db.assessment.findUnique({
      where: { id },
      include: {
        subject: { select: { programId: true } },
        assignedStudents: { select: { studentId: true } },
        questions: {
          include: { options: { orderBy: { orderIndex: "asc" } } },
          orderBy: { orderIndex: "asc" },
        },
      },
    });

    if (!source) return NextResponse.json({ error: "Assessment not found" }, { status: 404 });

    if (isTeacherOwnershipRestricted(session) && source.createdById !== session.user.id) {
      // Allow if teacher teaches the program that owns this assessment
      const programId = source.subject?.programId;
      if (programId) {
        const tp = await db.teacherProfile.findFirst({
          where: {
            userId: session.user.id,
            OR: [
              { teacherPrograms: { some: { programId } } },
              { subjectAssignments: { some: { subjectId: source.subjectId ?? "__none__" } } },
            ],
          },
        });
        if (!tp) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
      } else {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
      }
    }

    const copy = await db.assessment.create({
      data: {
        title: newTitle?.trim() || `${source.title} (Copy)`,
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
            mediaUrl: q.mediaUrl,
            mediaType: q.mediaType,
            additionalInfo: q.additionalInfo,
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
  } catch (e) {
    console.error("assessment copy", e);
    return NextResponse.json(
      {
        error:
          e instanceof Error
            ? e.message
            : "Could not copy assessment. Try again or contact support if this persists.",
      },
      { status: 500 }
    );
  }
}
