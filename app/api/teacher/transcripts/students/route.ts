import { requireTeacherPortal } from "@/lib/api-auth";
import { db } from "@/lib/db";
import { getTeacherVisibleBatchIds } from "@/lib/teacher-visible-batches";
import { NextResponse } from "next/server";

/** All students in batches the teacher can see — for use in transcript form. */
export async function GET(req: Request) {
  const gate = await requireTeacherPortal();
  if (!gate.ok) return gate.response;

  const allowedBatchIds = await getTeacherVisibleBatchIds(gate.session.user.id, gate.session);

  const { searchParams } = new URL(req.url);
  const programId = searchParams.get("programId") || undefined;

  const enrollments = await db.programEnrollment.findMany({
    where: {
      batchId: { in: allowedBatchIds },
      ...(programId ? { programId } : {}),
      status: { in: ["ENROLLED", "COMPLETED", "GRADUATED"] },
    },
    select: {
      userId: true,
      user: { select: { firstName: true, lastName: true, studentProfile: { select: { enrollmentNo: true } } } },
    },
    orderBy: { user: { firstName: "asc" } },
    distinct: ["userId"],
  });

  const students = enrollments.map((e) => ({
    id: e.userId,
    firstName: e.user.firstName,
    lastName: e.user.lastName,
    enrollmentNo: e.user.studentProfile?.enrollmentNo ?? null,
  }));

  return NextResponse.json({ students });
}
