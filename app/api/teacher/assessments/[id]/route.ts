import { requireTeacherPortal } from "@/lib/api-auth";
import { db } from "@/lib/db";
import { syncAssessmentAssignedStudents } from "@/lib/assessment-assigned-students";
import { isTeacherOwnershipRestricted } from "@/lib/portal-access";
import { NextResponse } from "next/server";
import type { Session } from "next-auth";

/** Returns true if this teacher session is allowed to access the given assessment. */
async function teacherCanAccess(
  session: Session,
  assessmentId: string
): Promise<{ allowed: boolean; assessment?: { createdById: string; subjectId: string | null } }> {
  if (!isTeacherOwnershipRestricted(session)) return { allowed: true };

  const assessment = await db.assessment.findUnique({
    where: { id: assessmentId },
    select: { createdById: true, subjectId: true, subject: { select: { programId: true } } },
  });
  if (!assessment) return { allowed: false };

  // Creator always has access
  if (assessment.createdById === session.user.id) return { allowed: true, assessment };

  // Check if teacher is assigned to the program or subject
  const teacherProfile = await db.teacherProfile.findUnique({
    where: { userId: session.user.id },
    select: {
      teacherPrograms: {
        where: { programId: assessment.subject?.programId ?? "__none__" },
        select: { id: true },
      },
      subjectAssignments: {
        where: { subjectId: assessment.subjectId ?? "__none__" },
        select: { id: true },
      },
    },
  });

  const allowed =
    (teacherProfile?.teacherPrograms.length ?? 0) > 0 ||
    (teacherProfile?.subjectAssignments.length ?? 0) > 0;

  return { allowed, assessment };
}

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const gate = await requireTeacherPortal();
  if (!gate.ok) return gate.response;
  const session = gate.session;

  const { allowed } = await teacherCanAccess(session, id);
  if (!allowed) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const assessment = await db.assessment.findUnique({
    where: { id },
    include: {
      subject: true,
      batch: { include: { program: true } },
      assignedStudents: { select: { studentId: true } },
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
  const gate2 = await requireTeacherPortal();
  if (!gate2.ok) return gate2.response;
  const session = gate2.session;

  const { allowed } = await teacherCanAccess(session, id);
  if (!allowed) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const existing = await db.assessment.findUnique({ where: { id }, select: { id: true } });
  if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });

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
      createdAt: body.createdAt ? new Date(body.createdAt) : undefined,
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

  const assigned = (body.assignedStudentIds as string[] | undefined)?.filter(Boolean);
  if (assigned !== undefined) {
    await syncAssessmentAssignedStudents(id, assigned);
  }

  return NextResponse.json({ id: assessment.id });
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const gate3 = await requireTeacherPortal();
  if (!gate3.ok) return gate3.response;
  const session = gate3.session;

  const { allowed } = await teacherCanAccess(session, id);
  if (!allowed) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const existing = await db.assessment.findUnique({ where: { id }, select: { id: true } });
  if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });

  await db.$transaction([
    db.answer.deleteMany({ where: { attempt: { assessmentId: id } } }),
    db.attempt.deleteMany({ where: { assessmentId: id } }),
    db.scheduledEmail.deleteMany({ where: { assessmentId: id } }),
    db.assessmentShare.deleteMany({ where: { assessmentId: id } }),
    db.question.deleteMany({ where: { assessmentId: id } }),
    db.assessment.delete({ where: { id } }),
  ]);

  return NextResponse.json({ success: true });
}
