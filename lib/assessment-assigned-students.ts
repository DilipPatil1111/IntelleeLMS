import { db } from "@/lib/db";
import type { Prisma } from "@/app/generated/prisma/client";

/** Replace assignment rows for an assessment (idempotent). */
export async function syncAssessmentAssignedStudents(assessmentId: string, studentIds: string[]) {
  const unique = [...new Set(studentIds.filter(Boolean))];
  await db.assessmentAssignedStudent.deleteMany({ where: { assessmentId } });
  if (unique.length === 0) return;
  await db.assessmentAssignedStudent.createMany({
    data: unique.map((studentId) => ({ assessmentId, studentId })),
  });
}

/**
 * Students see an assessment if it targets their batch AND either:
 * - no explicit assignment rows exist (legacy: whole batch), or
 * - they appear in assignedStudents.
 */
export function studentVisibleAssessmentFilter(
  studentUserId: string,
  batchId: string | null | undefined
): Prisma.AssessmentWhereInput {
  if (!batchId) {
    return { id: { equals: "__none__" } };
  }
  return {
    batchId,
    OR: [
      { assignedStudents: { none: {} } },
      { assignedStudents: { some: { studentId: studentUserId } } },
    ],
  };
}
