import { requireTeacherPortal } from "@/lib/api-auth";
import { db } from "@/lib/db";
import { syncAssessmentAssignedStudents } from "@/lib/assessment-assigned-students";
import { isTeacherOwnershipRestricted } from "@/lib/portal-access";
import { Prisma } from "@/app/generated/prisma/client";
import { NextResponse } from "next/server";

export async function GET(req: Request) {
  const gate = await requireTeacherPortal();
  if (!gate.ok) return gate.response;
  const session = gate.session;

  const { searchParams } = new URL(req.url);
  const q = searchParams.get("q")?.trim();
  const programId = searchParams.get("programId") || undefined;
  const batchId = searchParams.get("batchId") || undefined;
  const status = searchParams.get("status") || undefined;
  const type = searchParams.get("type") || undefined;

  let visibilityFilter: Prisma.AssessmentWhereInput;

  if (!isTeacherOwnershipRestricted(session)) {
    visibilityFilter = {};
  } else {
    const teacherProfile = await db.teacherProfile.findUnique({
      where: { userId: session.user.id },
      include: {
        teacherPrograms: { select: { programId: true } },
        subjectAssignments: { select: { subjectId: true } },
      },
    });
    const teacherProgramIds = teacherProfile?.teacherPrograms.map((tp) => tp.programId) ?? [];
    const teacherSubjectIds = teacherProfile?.subjectAssignments.map((sa) => sa.subjectId) ?? [];

    const orClauses: Prisma.AssessmentWhereInput[] = [{ createdById: session.user.id }];
    if (teacherProgramIds.length > 0) {
      orClauses.push({ subject: { programId: { in: teacherProgramIds } } });
    }
    if (teacherSubjectIds.length > 0) {
      orClauses.push({ subjectId: { in: teacherSubjectIds } });
    }
    visibilityFilter = { OR: orClauses };
  }

  const and: Prisma.AssessmentWhereInput[] = [visibilityFilter];

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

  const pageRaw = new URL(req.url).searchParams.get("page");
  const pageSizeRaw = new URL(req.url).searchParams.get("pageSize");
  const page = Math.max(1, Number.parseInt(pageRaw || "1", 10) || 1);
  let pageSize = Number.parseInt(pageSizeRaw || "5", 10) || 5;
  pageSize = Math.min(Math.max(1, pageSize), 50);

  const where: Prisma.AssessmentWhereInput = { AND: and };

  const [total, assessments] = await Promise.all([
    db.assessment.count({ where }),
    db.assessment.findMany({
      where,
      include: {
        subject: true,
        batch: { include: { program: true } },
        _count: { select: { attempts: true, questions: true } },
      },
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
  ]);

  return NextResponse.json({ assessments, total, page, pageSize });
}

export async function POST(req: Request) {
  const gate2 = await requireTeacherPortal();
  if (!gate2.ok) return gate2.response;
  const session = gate2.session;

  try {
    const body = await req.json();

    if (!body.subjectId || !body.batchId) {
      return NextResponse.json(
        { error: "Subject and batch are required. Go back to step 1 and select both." },
        { status: 400 }
      );
    }

    const rawIds = body.assignedStudentIds as string[] | undefined;
    const batchHasStudents =
      (await db.studentProfile.count({ where: { batchId: body.batchId } })) > 0;

    if (rawIds !== undefined && rawIds !== null) {
      const assigned = [...new Set(rawIds.filter(Boolean))];
      if (batchHasStudents && assigned.length === 0) {
        return NextResponse.json(
          { error: "Select at least one student in this batch to assign the assessment." },
          { status: 400 }
        );
      }
      if (assigned.length > 0) {
        const validInBatch = await db.studentProfile.count({
          where: { batchId: body.batchId, userId: { in: assigned } },
        });
        if (validInBatch !== assigned.length) {
          return NextResponse.json(
            {
              error:
                "One or more selected students are not in this batch. Refresh the page and pick students again.",
            },
            { status: 400 }
          );
        }
      }
    }

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
        passingMarks: body.passingMarks ?? null,
        duration: body.duration ?? null,
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
            maxLength: q.maxLength ?? null,
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

    if (rawIds !== undefined && rawIds !== null) {
      const assigned = [...new Set(rawIds.filter(Boolean))];
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
  } catch (e) {
    console.error("POST /api/teacher/assessments", e);
    if (e instanceof Prisma.PrismaClientKnownRequestError) {
      if (e.code === "P2003") {
        return NextResponse.json(
          {
            error:
              "Invalid subject, batch, or student link. Re-select program, subject, and batch on step 1, then try again.",
          },
          { status: 400 }
        );
      }
      if (e.code === "P2025") {
        return NextResponse.json({ error: "Record not found." }, { status: 400 });
      }
    }
    const message =
      e instanceof Error ? e.message : "Could not create assessment. If this persists, ensure the database migration for AssessmentAssignedStudent has been applied.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
