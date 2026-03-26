import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { NextResponse } from "next/server";

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const assessment = await db.assessment.findUnique({
    where: { id },
    include: {
      subject: true,
      batch: true,
      questions: {
        include: { options: { orderBy: { orderIndex: "asc" } } },
        orderBy: { orderIndex: "asc" },
      },
    },
  });

  if (!assessment) return NextResponse.json({ error: "Not found" }, { status: 404 });

  return NextResponse.json({ assessment });
}

export async function PUT(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();

  // Delete existing questions + options, recreate from body
  await db.question.deleteMany({ where: { assessmentId: id } });

  const assessment = await db.assessment.update({
    where: { id },
    data: {
      title: body.title,
      description: body.description || null,
      type: body.type,
      status: body.status || undefined,
      totalMarks: body.totalMarks || 0,
      passingMarks: body.passingMarks || null,
      duration: body.duration || null,
      subjectId: body.subjectId || undefined,
      batchId: body.batchId || undefined,
      scheduledOpenAt: body.scheduledOpenAt ? new Date(body.scheduledOpenAt) : null,
      scheduledCloseAt: body.scheduledCloseAt ? new Date(body.scheduledCloseAt) : null,
      assessmentDate: body.assessmentDate ? new Date(body.assessmentDate) : null,
      instructions: body.instructions || null,
      questions: {
        create: (body.questions || []).map((q: Record<string, unknown>, idx: number) => ({
          type: q.type,
          questionText: q.questionText,
          marks: (q.marks as number) || 1,
          orderIndex: idx,
          correctAnswer: (q.correctAnswer as string) || null,
          maxLength: (q.maxLength as number) || null,
          mediaUrl: (q.mediaUrl as string) || null,
          mediaType: (q.mediaType as string) || null,
          additionalInfo: (q.additionalInfo as string) || null,
          options: {
            create: ((q.options as Array<Record<string, unknown>>) || []).map(
              (o: Record<string, unknown>, oIdx: number) => ({
                optionText: o.optionText,
                isCorrect: o.isCorrect || false,
                orderIndex: oIdx,
              })
            ),
          },
        })),
      },
    },
  });

  return NextResponse.json({ id: assessment.id });
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  // Delete questions (cascades to options), attempts, answers, then assessment
  await db.answer.deleteMany({ where: { attempt: { assessmentId: id } } });
  await db.attempt.deleteMany({ where: { assessmentId: id } });
  await db.scheduledEmail.deleteMany({ where: { assessmentId: id } });
  await db.assessmentShare.deleteMany({ where: { assessmentId: id } });
  await db.question.deleteMany({ where: { assessmentId: id } });
  await db.assessment.delete({ where: { id } });

  return NextResponse.json({ success: true });
}
