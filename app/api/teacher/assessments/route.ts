import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { syncAssessmentAssignedStudents } from "@/lib/assessment-assigned-students";
import type { Prisma } from "@/app/generated/prisma/client";
import { NextResponse } from "next/server";

export async function GET(req: Request) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const q = searchParams.get("q")?.trim();
  const programId = searchParams.get("programId") || undefined;
  const batchId = searchParams.get("batchId") || undefined;
  const status = searchParams.get("status") || undefined;
  const type = searchParams.get("type") || undefined;

  const and: Prisma.AssessmentWhereInput[] = [{ createdById: session.user.id }];

  if (q) {
    and.push({
      OR: [
        { title: { contains: q, mode: "insensitive" } },
        { subject: { name: { contains: q, mode: "insensitive" } } },
      ],
    });
  }
  if (programId) and.push({ batch: { programId } });
  if (batchId) and.push({ batchId });
  if (status) and.push({ status: status as "DRAFT" | "PUBLISHED" | "CLOSED" | "GRADED" });
  if (type) and.push({ type: type as "QUIZ" | "TEST" | "ASSIGNMENT" | "PROJECT" | "HOMEWORK" });

  const assessments = await db.assessment.findMany({
    where: { AND: and },
    include: {
      subject: true,
      batch: { include: { program: true } },
      _count: { select: { attempts: true, questions: true } },
    },
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json({ assessments });
}

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
      moduleId: body.moduleNameText?.trim() ? null : body.moduleId || null,
      topicId: body.topicNameText?.trim() ? null : body.topicId || null,
      moduleNameText: body.moduleNameText?.trim() || null,
      topicNameText: body.topicNameText?.trim() || null,
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

  const rawIds = body.assignedStudentIds as string[] | undefined;
  const batchHasStudents =
    (await db.studentProfile.count({ where: { batchId: assessment.batchId } })) > 0;

  if (rawIds !== undefined && rawIds !== null) {
    const assigned = [...new Set(rawIds.filter(Boolean))];
    if (batchHasStudents && assigned.length === 0) {
      return NextResponse.json(
        { error: "Select at least one student in this batch to assign the assessment." },
        { status: 400 }
      );
    }
    await syncAssessmentAssignedStudents(assessment.id, assigned);
  } else {
    const inBatch = await db.studentProfile.findMany({
      where: { batchId: assessment.batchId },
      select: { userId: true },
    });
    await syncAssessmentAssignedStudents(
      assessment.id,
      inBatch.map((p) => p.userId)
    );
  }

  return NextResponse.json({ id: assessment.id });
}
