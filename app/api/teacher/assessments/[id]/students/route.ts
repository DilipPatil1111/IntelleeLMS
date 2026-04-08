import { requireTeacherPortal } from "@/lib/api-auth";
import { db } from "@/lib/db";
import { NextResponse } from "next/server";

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const gate = await requireTeacherPortal();
  if (!gate.ok) return gate.response;
  const session = gate.session;

  const assessment = await db.assessment.findUnique({
    where: { id },
    select: { batchId: true },
  });

  if (!assessment) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const [profiles, assignedRows] = await Promise.all([
    db.studentProfile.findMany({
      where: { batchId: assessment.batchId },
      include: {
        user: { select: { id: true, firstName: true, lastName: true, email: true } },
      },
    }),
    db.assessmentAssignedStudent.findMany({
      where: { assessmentId: id },
      select: { studentId: true },
    }),
  ]);

  const students = profiles.map((p) => ({
    id: p.user.id,
    firstName: p.user.firstName,
    lastName: p.user.lastName,
    email: p.user.email,
  }));

  const assignedStudentIds = assignedRows.map((r) => r.studentId);

  return NextResponse.json({
    students,
    /** Empty = legacy assessment (treat as whole batch in UI until publish saves rows). */
    assignedStudentIds,
  });
}
