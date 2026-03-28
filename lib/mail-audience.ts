import { db } from "@/lib/db";

/** Resolve student emails for announcements / holiday blasts (deduped). */
export async function resolveStudentEmails(filters: {
  studentIds?: string[];
  programId?: string | null;
  batchId?: string | null;
  academicYearId?: string | null;
  currentYearOnly?: boolean;
}): Promise<string[]> {
  if (filters.studentIds?.length) {
    const users = await db.user.findMany({
      where: { id: { in: filters.studentIds }, role: "STUDENT", isActive: true },
      select: { email: true },
    });
    return [...new Set(users.map((u) => u.email))];
  }

  let academicYearId = filters.academicYearId;
  if (filters.currentYearOnly && !academicYearId) {
    const y = await db.academicYear.findFirst({ where: { isCurrent: true } });
    academicYearId = y?.id;
  }

  const where: Record<string, unknown> = {};
  if (filters.batchId) {
    where.batchId = filters.batchId;
  } else if (filters.programId) {
    where.programId = filters.programId;
  }
  if (academicYearId && !filters.batchId) {
    where.batch = { academicYearId };
  }

  const profiles = await db.studentProfile.findMany({
    where: {
      ...where,
      status: { in: ["APPLIED", "ENROLLED", "ACCEPTED", "COMPLETED"] },
    },
    include: { user: { select: { email: true, isActive: true } } },
  });

  return [
    ...new Set(
      profiles.filter((p) => p.user.isActive).map((p) => p.user.email)
    ),
  ];
}
