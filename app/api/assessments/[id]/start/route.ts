import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { NextResponse } from "next/server";

export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const assessment = await db.assessment.findUnique({
    where: { id },
    include: {
      questions: {
        include: { options: { select: { id: true, optionText: true, orderIndex: true } } },
        orderBy: { orderIndex: "asc" },
      },
    },
  });

  if (!assessment || assessment.status !== "PUBLISHED") {
    return NextResponse.json({ error: "Assessment not available" }, { status: 400 });
  }

  let attempt = await db.attempt.findUnique({
    where: { assessmentId_studentId: { assessmentId: id, studentId: session.user.id } },
    include: { answers: true },
  });

  if (attempt && attempt.status === "SUBMITTED") {
    return NextResponse.json({ error: "You have already submitted this assessment" }, { status: 400 });
  }

  if (!attempt) {
    attempt = await db.attempt.create({
      data: { assessmentId: id, studentId: session.user.id, status: "IN_PROGRESS" },
      include: { answers: true },
    });
  }

  return NextResponse.json({
    id: assessment.id,
    title: assessment.title,
    description: assessment.description,
    type: assessment.type,
    totalMarks: assessment.totalMarks,
    duration: assessment.duration,
    instructions: assessment.instructions,
    attemptId: attempt.id,
    questions: assessment.questions.map((q) => ({
      id: q.id,
      type: q.type,
      questionText: q.questionText,
      marks: q.marks,
      orderIndex: q.orderIndex,
      maxLength: q.maxLength,
      mediaUrl: q.mediaUrl,
      mediaType: q.mediaType,
      additionalInfo: q.additionalInfo,
      options: q.options,
    })),
    existingAnswers: attempt.answers,
  });
}
