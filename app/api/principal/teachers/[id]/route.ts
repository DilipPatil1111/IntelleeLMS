import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { emailTeacherIfTeachingChanged, type TeacherTeachingSnapshot } from "@/lib/teacher-profile-email-notify";
import { NextResponse } from "next/server";

export async function PUT(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  const user = await db.user.findUnique({
    where: { id, role: "TEACHER" },
    include: { teacherProfile: true },
  });
  if (!user?.teacherProfile) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const [prevProgramsSnap, prevAssignSnap] = await Promise.all([
    db.teacherProgram.findMany({
      where: { teacherProfileId: user.teacherProfile.id },
      select: { programId: true },
    }),
    db.teacherSubjectAssignment.findMany({
      where: { teacherProfileId: user.teacherProfile.id },
      select: { subjectId: true, batchId: true },
    }),
  ]);
  const beforeSnapshot: TeacherTeachingSnapshot = {
    programIds: prevProgramsSnap.map((p) => p.programId),
    assignments: prevAssignSnap.map((a) => ({ subjectId: a.subjectId, batchId: a.batchId })),
  };

  await db.user.update({
    where: { id },
    data: {
      firstName: body.firstName,
      lastName: body.lastName,
      middleName: body.middleName ?? undefined,
      phone: body.phone ?? undefined,
      email: body.email,
      isActive: body.isActive ?? true,
    },
  });

  await db.teacherProfile.update({
    where: { id: user.teacherProfile.id },
    data: {
      employeeId: body.employeeId,
      department: body.department ?? undefined,
      qualification: body.qualification ?? undefined,
      specialization: body.specialization ?? undefined,
    },
  });

  let cleanedAssignments: { subjectId: string; batchId: string }[] | null = null;

  if (Array.isArray(body.subjectAssignments)) {
    const raw = body.subjectAssignments as { subjectId?: string; batchId?: string }[];
    const seen = new Set<string>();
    const cleaned: { subjectId: string; batchId: string }[] = [];
    for (const row of raw) {
      if (!row?.subjectId || !row?.batchId) continue;
      const k = `${row.subjectId}:${row.batchId}`;
      if (seen.has(k)) continue;
      seen.add(k);
      cleaned.push({ subjectId: row.subjectId, batchId: row.batchId });
    }

    for (const row of cleaned) {
      const [subject, batch] = await Promise.all([
        db.subject.findUnique({ where: { id: row.subjectId } }),
        db.batch.findUnique({ where: { id: row.batchId } }),
      ]);
      if (!subject || !batch || subject.programId !== batch.programId) {
        return NextResponse.json(
          {
            error:
              "Invalid course assignment: each subject must belong to the same program as the selected batch.",
          },
          { status: 400 }
        );
      }
    }
    cleanedAssignments = cleaned;
  }

  if (Array.isArray(body.programIds)) {
    const mergedProgramIds: string[] = body.programIds.filter(Boolean);
    if (cleanedAssignments) {
      for (const row of cleanedAssignments) {
        const subject = await db.subject.findUnique({ where: { id: row.subjectId } });
        if (subject && !mergedProgramIds.includes(subject.programId)) {
          mergedProgramIds.push(subject.programId);
        }
      }
    }
    await db.teacherProgram.deleteMany({ where: { teacherProfileId: user.teacherProfile.id } });
    if (mergedProgramIds.length > 0) {
      await db.teacherProgram.createMany({
        data: mergedProgramIds.map((programId: string) => ({
          teacherProfileId: user.teacherProfile!.id,
          programId,
        })),
        skipDuplicates: true,
      });
    }
  }

  if (cleanedAssignments) {
    const cleaned = cleanedAssignments;

    await db.$transaction(async (tx) => {
      await tx.teacherSubjectAssignment.deleteMany({ where: { teacherProfileId: user.teacherProfile!.id } });
      if (cleaned.length > 0) {
        await tx.teacherSubjectAssignment.createMany({
          data: cleaned.map((r) => ({
            teacherProfileId: user.teacherProfile!.id,
            subjectId: r.subjectId,
            batchId: r.batchId,
          })),
        });
      }
    });

  }

  if (Array.isArray(body.programIds) || Array.isArray(body.subjectAssignments)) {
    await emailTeacherIfTeachingChanged(id, user.teacherProfile.id, beforeSnapshot);
  }

  return NextResponse.json({ success: true });
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const user = await db.user.findUnique({ where: { id, role: "TEACHER" } });
  if (!user) return NextResponse.json({ error: "Not found" }, { status: 404 });

  await db.user.update({ where: { id }, data: { isActive: false } });

  return NextResponse.json({ success: true });
}
