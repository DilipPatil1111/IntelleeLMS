import { db } from "@/lib/db";

export type CatalogSubject = {
  id: string;
  name: string;
  programId: string;
  program: { name: string };
};

export type CatalogBatch = {
  id: string;
  name: string;
  programId: string;
  program: { name: string };
};

/**
 * Subjects and batches this teacher may use (TeacherSubjectAssignment rows +
 * TeacherProgram — all subjects/batches in those programs).
 * Matches {@link getTeacherVisibleBatchIds} so dropdown choices always load students.
 */
export async function getTeacherCatalogForOptions(teacherUserId: string): Promise<{
  programRows: { id: string; name: string }[];
  subjectRows: CatalogSubject[];
  batchRows: CatalogBatch[];
}> {
  const profile = await db.teacherProfile.findUnique({
    where: { userId: teacherUserId },
    include: {
      subjectAssignments: true,
      teacherPrograms: true,
    },
  });

  if (!profile) {
    return { programRows: [], subjectRows: [], batchRows: [] };
  }

  const assignmentSubjectIds = [...new Set(profile.subjectAssignments.map((a) => a.subjectId))];
  const assignmentBatchIds = [...new Set(profile.subjectAssignments.map((a) => a.batchId))];
  const programIds = [...new Set(profile.teacherPrograms.map((p) => p.programId))];

  const hasAssignments = profile.subjectAssignments.length > 0;
  const hasPrograms = programIds.length > 0;

  if (!hasAssignments && !hasPrograms) {
    return { programRows: [], subjectRows: [], batchRows: [] };
  }

  const [subjectsFromPrograms, subjectsFromAssignments, batchesFromPrograms, batchesFromAssignments] =
    await Promise.all([
      hasPrograms
        ? db.subject.findMany({
            where: { programId: { in: programIds }, isActive: true },
            include: { program: true },
            orderBy: { name: "asc" },
          })
        : Promise.resolve([]),
      hasAssignments
        ? db.subject.findMany({
            where: { id: { in: assignmentSubjectIds }, isActive: true },
            include: { program: true },
            orderBy: { name: "asc" },
          })
        : Promise.resolve([]),
      hasPrograms
        ? db.batch.findMany({
            where: { programId: { in: programIds }, isActive: true },
            include: { program: true },
            orderBy: { name: "asc" },
          })
        : Promise.resolve([]),
      hasAssignments
        ? db.batch.findMany({
            where: { id: { in: assignmentBatchIds }, isActive: true },
            include: { program: true },
            orderBy: { name: "asc" },
          })
        : Promise.resolve([]),
    ]);

  const subjectMap = new Map<string, (typeof subjectsFromPrograms)[0]>();
  for (const s of subjectsFromAssignments) subjectMap.set(s.id, s);
  for (const s of subjectsFromPrograms) subjectMap.set(s.id, s);
  const subjectRows = [...subjectMap.values()].sort((a, b) => a.name.localeCompare(b.name));

  const batchMap = new Map<string, (typeof batchesFromPrograms)[0]>();
  for (const b of batchesFromAssignments) batchMap.set(b.id, b);
  for (const b of batchesFromPrograms) batchMap.set(b.id, b);
  const batchRows = [...batchMap.values()].sort((a, b) => a.name.localeCompare(b.name));

  const programMap = new Map<string, { id: string; name: string }>();
  for (const s of subjectRows) {
    programMap.set(s.programId, { id: s.program.id, name: s.program.name });
  }
  for (const b of batchRows) {
    programMap.set(b.programId, { id: b.program.id, name: b.program.name });
  }
  const programRows = [...programMap.values()].sort((a, b) => a.name.localeCompare(b.name));

  return { programRows, subjectRows, batchRows };
}
