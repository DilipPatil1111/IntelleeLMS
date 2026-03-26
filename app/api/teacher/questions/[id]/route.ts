import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { NextResponse } from "next/server";

export async function PUT(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const owned = await db.question.findFirst({
    where: { id, assessment: { createdById: session.user.id } },
  });
  if (!owned) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const body = await req.json();

  const question = await db.question.update({
    where: { id },
    data: {
      questionText: body.questionText,
      type: body.type,
      marks: body.marks,
      correctAnswer: body.correctAnswer || null,
      mediaUrl: body.mediaUrl || null,
      mediaType: body.mediaType || null,
      additionalInfo: body.additionalInfo || null,
    },
  });

  if (body.type === "MCQ" && body.options) {
    await db.questionOption.deleteMany({ where: { questionId: id } });
    for (let i = 0; i < body.options.length; i++) {
      await db.questionOption.create({
        data: {
          questionId: id,
          optionText: body.options[i].optionText,
          isCorrect: body.options[i].isCorrect || false,
          orderIndex: i,
        },
      });
    }
  } else if (body.type !== "MCQ") {
    await db.questionOption.deleteMany({ where: { questionId: id } });
  }

  return NextResponse.json({ question });
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const owned = await db.question.findFirst({
    where: { id, assessment: { createdById: session.user.id } },
  });
  if (!owned) return NextResponse.json({ error: "Not found" }, { status: 404 });

  await db.question.delete({ where: { id } });
  return NextResponse.json({ success: true });
}
