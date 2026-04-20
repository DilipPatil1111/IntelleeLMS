import { requireTeacherPortal } from "@/lib/api-auth";
import { db } from "@/lib/db";
import { NextResponse } from "next/server";

/**
 * List all students who can appear on the attendance report for a given batch.
 *
 * We intentionally union two sources so the dropdown matches the attendance
 * recording surface 1:1 (a student that can have attendance recorded MUST be
 * selectable in the report):
 *   1. Users whose `studentProfile.batchId` points at this batch — this is
 *      the same path used by /api/teacher/students, /api/teacher/attendance
 *      and the attendance grid.
 *   2. Users with a `ProgramEnrollment` on this batch (any status except
 *      purely dropped records). This covers legacy students whose
 *      studentProfile was re-assigned but still have attendance history.
 */
export async function GET(req: Request) {
  const gate = await requireTeacherPortal();
  if (!gate.ok) return gate.response;

  const { searchParams } = new URL(req.url);
  const batchId = searchParams.get("batchId");
  if (!batchId) return NextResponse.json({ error: "batchId required" }, { status: 400 });

  const users = await db.user.findMany({
    where: {
      role: "STUDENT",
      OR: [
        { studentProfile: { batchId } },
        { programEnrollments: { some: { batchId } } },
      ],
    },
    select: { id: true, firstName: true, lastName: true },
    orderBy: [{ firstName: "asc" }, { lastName: "asc" }],
  });

  const students = users.map((u) => ({
    userId: u.id,
    name: `${u.firstName} ${u.lastName}`.trim(),
  }));

  return NextResponse.json({ students });
}
