import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { NextResponse } from "next/server";

export async function POST(req: Request, _params: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  const { attemptId, answers } = body;

  const attempt = await db.attempt.findUnique({
    where: { id: attemptId },
    include: { assessment: { include: { questions: { include: { options: true } } } } },
  });

  if (!attempt || attempt.studentId !== session.user.id) {
    return NextResponse.json({ error: "Invalid attempt" }, { status: 400 });
  }

  if (attempt.status === "SUBMITTED" || attempt.status === "GRADED") {
    return NextResponse.json({ error: "Already submitted" }, { status: 400 });
  }

  let autoTotal = 0;

  for (const question of attempt.assessment.questions) {
    const studentAnswer = (answers as Record<string, string>)[question.id] || "";

    let autoScore: number | null = null;
    let selectedOptionId: string | null = null;
    let answerText: string | null = null;

    if (question.type === "MCQ") {
      selectedOptionId = studentAnswer;
      const correctOption = question.options.find((o) => o.isCorrect);
      autoScore = correctOption && correctOption.id === selectedOptionId ? question.marks : 0;
      autoTotal += autoScore;
    } else {
      answerText = studentAnswer;
    }

    await db.answer.upsert({
      where: {
        id: (await db.answer.findFirst({ where: { attemptId, questionId: question.id } }))?.id || "new",
      },
      create: {
        attemptId,
        questionId: question.id,
        studentId: session.user.id,
        answerText,
        selectedOptionId,
        autoScore,
        isGraded: question.type === "MCQ",
      },
      update: {
        answerText,
        selectedOptionId,
        autoScore,
        isGraded: question.type === "MCQ",
      },
    });
  }

  const hasSubjective = attempt.assessment.questions.some((q) => q.type !== "MCQ");

  await db.attempt.update({
    where: { id: attemptId },
    data: {
      status: hasSubjective ? "SUBMITTED" : "GRADED",
      submittedAt: new Date(),
      totalScore: hasSubjective ? null : autoTotal,
      percentage: hasSubjective ? null : (attempt.assessment.totalMarks > 0 ? Math.round((autoTotal / attempt.assessment.totalMarks) * 100 * 100) / 100 : 0),
    },
  });

  return NextResponse.json({ success: true });
}
