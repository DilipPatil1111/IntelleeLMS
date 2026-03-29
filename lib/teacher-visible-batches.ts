import { db } from "@/lib/db";

/**
 * Batch IDs a teacher may see students for: explicit subject/batch assignments plus
 * all batches under programs linked via TeacherProgram (program-only assignment).
 */
export async function getTeacherVisibleBatchIds(teacherUserId: string): Promise<string[]> {
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
