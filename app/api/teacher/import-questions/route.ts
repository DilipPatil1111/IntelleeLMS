import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { NextResponse } from "next/server";

interface ImportedQuestion {
  type: "MCQ" | "SHORT" | "PARAGRAPH";
  questionText: string;
  marks: number;
  correctAnswer?: string;
  options?: { optionText: string; isCorrect: boolean }[];
  maxLength?: number;
}

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  const { assessmentId, questions } = body as {
    assessmentId: string;
    questions: ImportedQuestion[];
  };

  if (!assessmentId || !Array.isArray(questions) || questions.length === 0) {
    return NextResponse.json({ error: "assessmentId and a non-empty questions array are required" }, { status: 400 });
  }

  const assessment = await db.assessment.findUnique({ where: { id: assessmentId } });
  if (!assessment) return NextResponse.json({ error: "Assessment not found" }, { status: 404 });

  const currentCount = await db.question.count({ where: { assessmentId } });
  const errors: string[] = [];
  let imported = 0;

  for (let i = 0; i < questions.length; i++) {
    const q = questions[i];
    if (!q.questionText || !q.type) {
      errors.push(`Row ${i + 1}: missing questionText or type`);
      continue;
    }
    if (!["MCQ", "SHORT", "PARAGRAPH"].includes(q.type)) {
      errors.push(`Row ${i + 1}: invalid type "${q.type}"`);
      continue;
    }
    if (q.type === "MCQ" && (!q.options || q.options.length < 2)) {
      errors.push(`Row ${i + 1}: MCQ requires at least 2 options`);
      continue;
    }

    await db.question.create({
      data: {
        assessmentId,
        type: q.type,
        questionText: q.questionText,
        marks: q.marks || 1,
        orderIndex: currentCount + imported,
        correctAnswer: q.correctAnswer || null,
        maxLength: q.maxLength || null,
        options: q.type === "MCQ" && q.options
          ? {
              create: q.options.map((o, oIdx) => ({
                optionText: o.optionText,
                isCorrect: o.isCorrect || false,
                orderIndex: oIdx,
              })),
            }
          : undefined,
      },
    });
    imported++;
  }

  const newTotal = await db.question.aggregate({
    where: { assessmentId },
    _sum: { marks: true },
  });
  await db.assessment.update({
    where: { id: assessmentId },
    data: { totalMarks: newTotal._sum.marks || 0 },
  });

  return NextResponse.json({ imported, errors, total: currentCount + imported });
}
