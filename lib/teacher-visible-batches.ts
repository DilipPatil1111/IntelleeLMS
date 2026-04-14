import { db } from "@/lib/db";
import type { Session } from "next-auth";
import { isTeacherOwnershipRestricted } from "@/lib/portal-access";

/**
 * Batch IDs a teacher may see students for: explicit subject/batch assignments plus
 * all batches under programs linked via TeacherProgram (program-only assignment).
 *
 * When a session is provided and the caller is a Principal (not ownership-restricted),
 * returns ALL active batch IDs so Principals can manage every batch from the teacher portal.
 */
export async function getTeacherVisibleBatchIds(
  teacherUserId: string,
  session?: Session | null,
): Promise<string[]> {
  if (session && !isTeacherOwnershipRestricted(session)) {
    const allBatches = await db.batch.findMany({
      where: { isActive: true },
      select: { id: true },
    });
    return allBatches.map((b) => b.id);
  }

  const profile = await db.teacherProfile.findUnique({
    where: { userId: teacherUserId },
    include: {
      subjectAssignments: true,
      teacherPrograms: { select: { programId: true } },
    },
  });
  if (!profile) return [];

  const fromSubjects = [...new Set(profile.subjectAssignments.map((a) => a.batchId))];
  const programIds = [...new Set(profile.teacherPrograms.map((p) => p.programId))];

  let fromPrograms: string[] = [];
  if (programIds.length > 0) {
    const batches = await db.batch.findMany({
      where: { programId: { in: programIds }, isActive: true },
      select: { id: true },
    });
    fromPrograms = batches.map((b) => b.id);
  }

  return [...new Set([...fromSubjects, ...fromPrograms])];
}
