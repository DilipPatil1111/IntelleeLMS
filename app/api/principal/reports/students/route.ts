import { requirePrincipalPortal } from "@/lib/api-auth";
import { db } from "@/lib/db";
import type { Prisma } from "@/app/generated/prisma/client";
import { NextResponse } from "next/server";

/**
 * Lightweight student picker for  Principal → Reports → Performance filter.
 *
 * Returns the superset of students who could plausibly appear on a
 * performance row for the caller's current Program / Batch filters:
 *   - Student's canonical `studentProfile.batchId` matches the filter, OR
 *   - Student has a `ProgramEnrollment` in the filtered program/batch.
 *
 * This mirrors the pattern used by the attendance-report student picker
 * so that principals see the same pool of students regardless of which
 * report they're filtering.
 *
 * All filters are optional. If none are supplied, every STUDENT user is
 * returned (capped sensibly via orderBy + a large default).
 */
export async function GET(req: Request) {
  const gate = await requirePrincipalPortal();
  if (!gate.ok) return gate.response;

  const { searchParams } = new URL(req.url);
  const programId = searchParams.get("programId") || undefined;
  const batchId = searchParams.get("batchId") || undefined;

  // Build two OR clauses: one for studentProfile, one for programEnrollments.
  // If the caller specified no program/batch filter at all, both clauses
  // degrade to "any STUDENT", which Prisma handles cleanly with an empty
  // `some: {}` — but we short-circuit and skip the OR altogether to keep
  // the query plan simple in that common case.
  let where: Prisma.UserWhereInput = { role: "STUDENT" };

  if (programId || batchId) {
    const profileFilter: Prisma.StudentProfileWhereInput = {};
    const enrollmentFilter: Prisma.ProgramEnrollmentWhereInput = {};
    if (programId) {
      profileFilter.programId = programId;
      enrollmentFilter.programId = programId;
    }
    if (batchId) {
      profileFilter.batchId = batchId;
      enrollmentFilter.batchId = batchId;
    }
    where = {
      ...where,
      OR: [
        { studentProfile: profileFilter },
        { programEnrollments: { some: enrollmentFilter } },
      ],
    };
  }

  const users = await db.user.findMany({
    where,
    select: { id: true, firstName: true, lastName: true },
    orderBy: [{ firstName: "asc" }, { lastName: "asc" }],
    take: 1000,
  });

  const students = users.map((u) => ({
    id: u.id,
    name: `${u.firstName} ${u.lastName}`.trim(),
  }));

  return NextResponse.json({ students });
}
