import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { NextResponse } from "next/server";

export async function GET() {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const user = await db.user.findUnique({
    where: { id: session.user.id },
    include: {
      teacherProfile: {
        include: {
          subjectAssignments: {
            include: { subject: true, batch: true },
          },
        },
      },
    },
  });

  const subjects = user?.teacherProfile?.subjectAssignments.map((a) => ({
    value: a.subjectId,
    label: a.subject.name,
  })) || [];

  const batches = user?.teacherProfile?.subjectAssignments.map((a) => ({
    value: a.batchId,
    label: a.batch.name,
  })) || [];

  const uniqueSubjects = subjects.filter((s, i, arr) => arr.findIndex((x) => x.value === s.value) === i);
  const uniqueBatches = batches.filter((b, i, arr) => arr.findIndex((x) => x.value === b.value) === i);

  const programs = await db.program.findMany({
    where: { isActive: true },
    select: { id: true, name: true },
  });

  return NextResponse.json({
    subjects: uniqueSubjects,
    batches: uniqueBatches,
    programs: programs.map((p) => ({ value: p.id, label: p.name })),
  });
}
