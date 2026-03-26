import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { NextResponse } from "next/server";

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();

  const assessment = await db.assessment.create({
    data: {
      title: body.title,
      description: body.description || null,
      type: body.type,
      status: body.status || "DRAFT",
      subjectId: body.subjectId,
      batchId: body.batchId,
      createdById: session.user.id,
      totalMarks: body.totalMarks || 0,
      passingMarks: body.passingMarks || null,
      duration: body.duration || null,
      scheduledOpenAt: body.scheduledOpenAt ? new Date(body.scheduledOpenAt) : null,
      scheduledCloseAt: body.scheduledCloseAt ? new Date(body.scheduledCloseAt) : null,
      assessmentDate: body.assessmentDate ? new Date(body.assessmentDate) : null,
      instructions: body.instructions || null,
      moduleId: body.moduleId || null,
      topicId: body.topicId || null,
      isMandatory: body.isMandatory || false,
      questions: {
        create: (body.questions || []).map((q: Record<string, unknown>, idx: number) => ({
          type: q.type,
          questionText: q.questionText,
          marks: q.marks || 1,
          orderIndex: idx,
          correctAnswer: q.correctAnswer || null,
          maxLength: q.maxLength || null,
          mediaUrl: (q.mediaUrl as string) || null,
          mediaType: (q.mediaType as string) || null,
          additionalInfo: (q.additionalInfo as string) || null,
          options: {
            create: ((q.options as Array<Record<string, unknown>>) || []).map((o: Record<string, unknown>, oIdx: number) => ({
              optionText: o.optionText,
              isCorrect: o.isCorrect || false,
              orderIndex: oIdx,
            })),
          },
        })),
      },
    },
  });

  return NextResponse.json({ id: assessment.id });
}
