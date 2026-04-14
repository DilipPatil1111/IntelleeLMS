import { requireTeacherPortal } from "@/lib/api-auth";
import { db } from "@/lib/db";
import { NextResponse } from "next/server";

export async function GET(_req: Request, { params }: { params: Promise<{ attemptId: string }> }) {
  const { attemptId } = await params;
  const gate = await requireTeacherPortal();
  if (!gate.ok) return gate.response;
  const session = gate.session;

  const attempt = await db.attempt.findUnique({
    where: { id: attemptId },
    include: {
      student: true,
      assessment: true,
      answers: {
        include: {
          question: { include: { options: true } },
        },
        orderBy: { question: { orderIndex: "asc" } },
      },
    },
  });

  if (!attempt) return NextResponse.json({ error: "Not found" }, { status: 404 });

  return NextResponse.json({
    id: attempt.id,
    studentName: `${attempt.student.firstName} ${attempt.student.lastName}`,
    assessmentTitle: attempt.assessment.title,
    totalMarks: attempt.assessment.totalMarks,
    feedback: attempt.feedback,
    answers: attempt.answers,
  });
}

export async function POST(req: Request, { params }: { params: Promise<{ attemptId: string }> }) {
  const { attemptId } = await params;
  const gate2 = await requireTeacherPortal();
  if (!gate2.ok) return gate2.response;
  const session = gate2.session;

  const body = await req.json();
  const { scores, feedbacks, overallFeedback } = body;

  const attempt = await db.attempt.findUnique({
    where: { id: attemptId },
    include: { assessment: true, answers: true },
  });

  if (!attempt) return NextResponse.json({ error: "Not found" }, { status: 404 });

  for (const answer of attempt.answers) {
    const score = scores[answer.id] ?? 0;
    const feedback = feedbacks[answer.id] || null;
    await db.answer.update({
      where: { id: answer.id },
      data: { manualScore: score, feedback, isGraded: true },
    });
  }

  const totalScore = Object.values(scores as Record<string, number>).reduce((s: number, v: number) => s + v, 0);
  const percentage = attempt.assessment.totalMarks > 0
    ? Math.round((totalScore / attempt.assessment.totalMarks) * 100 * 100) / 100
    : 0;

  await db.attempt.update({
    where: { id: attemptId },
    data: {
      status: "GRADED",
      totalScore,
      percentage,
      feedback: overallFeedback || null,
    },
  });

  return NextResponse.json({ success: true });
}
