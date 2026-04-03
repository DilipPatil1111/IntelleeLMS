import type { Prisma } from "@/app/generated/prisma/client";
import { db } from "@/lib/db";

const ACTIVE_STUDENT_STATUSES = ["APPLIED", "ENROLLED", "ACCEPTED", "COMPLETED"] as const;

export type ResolveStudentEmailFilters = {
  studentIds?: string[];
  programId?: string | null;
  batchId?: string | null;
  academicYearId?: string | null;
  currentYearOnly?: boolean;
  /** Multi-select audience (principal announcements). Omit or leave unset for legacy single-ID behavior. */
  allPrograms?: boolean;
  allBatches?: boolean;
  programIds?: string[];
  batchIds?: string[];
};

/** Resolve student emails for announcements / holiday blasts (deduped). */
export async function resolveStudentEmails(filters: ResolveStudentEmailFilters): Promise<string[]> {
  if (filters.studentIds?.length) {
    const users = await db.user.findMany({
      where: { id: { in: filters.studentIds }, role: "STUDENT", isActive: true },
      select: { email: true },
    });
    return [...new Set(users.map((u) => u.email))];
  }

  const useMulti =
    filters.allPrograms !== undefined ||
    filters.allBatches !== undefined ||
    (filters.programIds?.length ?? 0) > 0 ||
    (filters.batchIds?.length ?? 0) > 0;

  if (useMulti) {
    return resolveStudentEmailsMulti(filters);
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
      status: { in: [...ACTIVE_STUDENT_STATUSES] },
    },
    include: { user: { select: { email: true, isActive: true } } },
  });

  return [
    ...new Set(
      profiles.filter((p) => p.user.isActive).map((p) => p.user.email)
    ),
  ];
}

async function resolveStudentEmailsMulti(filters: ResolveStudentEmailFilters): Promise<string[]> {
  const allPrograms = filters.allPrograms === true;
  const allBatches = filters.allBatches === true;
  const programIds = filters.programIds?.filter(Boolean) ?? [];
  const batchIds = filters.batchIds?.filter(Boolean) ?? [];

  const currentYear = await db.academicYear.findFirst({ where: { isCurrent: true } });

  const base: Prisma.StudentProfileWhereInput = {
    status: { in: [...ACTIVE_STUDENT_STATUSES] },
  };

  let where: Prisma.StudentProfileWhereInput = { ...base };

  if (!allBatches && batchIds.length > 0) {
    where = {
      ...base,
      batchId: { in: batchIds },
      ...(!allPrograms && programIds.length > 0 ? { programId: { in: programIds } } : {}),
    };
  } else if (!allPrograms && programIds.length > 0) {
    where = {
      ...base,
      programId: { in: programIds },
      ...(currentYear ? { batch: { academicYearId: currentYear.id } } : {}),
    };
  } else if (allPrograms && allBatches) {
    where = currentYear
      ? { ...base, batch: { academicYearId: currentYear.id } }
      : { ...base, id: { in: [] } };
  } else {
    where = { ...base, id: { in: [] } };
  }

  const profiles = await db.studentProfile.findMany({
    where,
    include: { user: { select: { email: true, isActive: true } } },
  });

  return [
    ...new Set(
      profiles.filter((p) => p.user.isActive).map((p) => p.user.email)
    ),
  ];
}
