import { db } from "@/lib/db";
import { studentVisibleAssessmentFilter } from "@/lib/assessment-assigned-students";

/**
 * Lists assessments visible to a student in their batch.
 * Falls back to batch-only matching if the DB/relation query fails (e.g. migration not applied).
 */
export async function findAssessmentsForStudentList(userId: string, batchId: string | null | undefined) {
  if (!batchId) return [];

  const include = {
    subject: true,
    attempts: { where: { studentId: userId } },
    _count: { select: { questions: true } },
  };

  try {
    return await db.assessment.findMany({
      where: {
        status: { in: ["PUBLISHED", "CLOSED", "GRADED"] },
        AND: [studentVisibleAssessmentFilter(userId, batchId)],
      },
      include,
      orderBy: { createdAt: "desc" },
    });
  } catch (err) {
    console.error("findAssessmentsForStudentList (fallback to batch-only)", err);
    return await db.assessment.findMany({
      where: {
        batchId,
        status: { in: ["PUBLISHED", "CLOSED", "GRADED"] },
      },
      include,
      orderBy: { createdAt: "desc" },
    });
  }
}

export async function countPendingAssessmentsForStudent(userId: string, batchId: string | null | undefined) {
  if (!batchId) return 0;

  try {
    return await db.assessment.count({
      where: {
        status: "PUBLISHED",
        attempts: { none: { studentId: userId } },
        AND: [studentVisibleAssessmentFilter(userId, batchId)],
      },
    });
  } catch (err) {
    console.error("countPendingAssessmentsForStudent (fallback)", err);
    return await db.assessment.count({
      where: {
        batchId,
        status: "PUBLISHED",
        attempts: { none: { studentId: userId } },
      },
    });
  }
}

const takeInclude = {
  questions: {
    include: { options: { select: { id: true, optionText: true, orderIndex: true } } },
    orderBy: { orderIndex: "asc" as const },
  },
};

/** Published assessment for starting a take session; falls back if assignment filter query fails. */
export async function findPublishedAssessmentForTake(
  assessmentId: string,
  userId: string,
  batchId: string | null | undefined
) {
  try {
    return await db.assessment.findFirst({
      where: {
        id: assessmentId,
        status: "PUBLISHED",
        AND: [studentVisibleAssessmentFilter(userId, batchId)],
      },
      include: takeInclude,
    });
  } catch (err) {
    console.error("findPublishedAssessmentForTake (fallback)", err);
    if (!batchId) return null;
    return await db.assessment.findFirst({
      where: {
        id: assessmentId,
        status: "PUBLISHED",
        batchId,
      },
      include: takeInclude,
    });
  }
}
