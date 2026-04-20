import { requirePrincipalPortal } from "@/lib/api-auth";
import { db } from "@/lib/db";
import { NextResponse } from "next/server";

/**
 * Lists every student that can appear on the attendance report for a batch.
 *
 * The dropdown must be a strict superset of the students who can actually have
 * attendance recorded (otherwise teachers/principals end up with attendance
 * data they cannot view through the report). We therefore union two sources:
 *   1. `studentProfile.batchId === batchId` — the canonical path used by the
 *      attendance recording UI (`/api/teacher/students`,
 *      `/api/teacher/attendance`, attendance grid).
 *   2. Users with a `ProgramEnrollment` on this batch — covers students whose
 *      profile was re-assigned but still have historical attendance for this
 *      batch.
 */
export async function GET(req: Request) {
  const gate = await requirePrincipalPortal();
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
