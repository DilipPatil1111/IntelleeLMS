import { db } from "@/lib/db";
import type { ApplicationStatus } from "@/app/generated/prisma/enums";
import type { StudentStatus } from "@/app/generated/prisma/enums";

export function mapStudentStatusToApplicationStatus(status: StudentStatus): ApplicationStatus {
  switch (status) {
    case "APPLIED":
    case "RETAKE":
      return "PENDING";
    case "ACCEPTED":
      return "ACCEPTED";
    case "ENROLLED":
    case "COMPLETED":
    case "GRADUATED":
      return "ENROLLED";
    default:
      return "PENDING";
  }
}

/**
 * Principal-added students (and legacy rows) may have StudentProfile + program without a ProgramApplication.
 * Creates a matching application so they appear under Applications and filters.
 */
const SYNCABLE_STATUSES: StudentStatus[] = [
  "APPLIED",
  "ACCEPTED",
  "ENROLLED",
  "COMPLETED",
  "GRADUATED",
  "RETAKE",
];

export async function syncMissingProgramApplicationsFromProfiles(): Promise<{ created: number }> {
  const profiles = await db.studentProfile.findMany({
    where: { programId: { not: null }, status: { in: SYNCABLE_STATUSES } },
    select: {
      userId: true,
      programId: true,
      batchId: true,
      status: true,
    },
  });

  let created = 0;

  for (const p of profiles) {
    if (!p.programId) continue;

    const existing = await db.programApplication.findFirst({
      where: { applicantId: p.userId, programId: p.programId },
    });
    if (existing) continue;

    await db.programApplication.create({
      data: {
        applicantId: p.userId,
        programId: p.programId,
        batchId: p.batchId,
        status: mapStudentStatusToApplicationStatus(p.status),
        personalStatement: null,
      },
    });
    created += 1;
  }

  return { created };
}
