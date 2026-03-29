import { db } from "@/lib/db";

/**
 * When `StudentProfile.status` becomes ENROLLED, align the matching `ProgramApplication` row(s)
 * (same applicant + program).
 */
export async function syncProgramApplicationsWithProfileEnrolled(
  userId: string,
  programId: string | null | undefined
): Promise<void> {
  if (!programId) return;
  await db.programApplication.updateMany({
    where: { applicantId: userId, programId },
    data: { status: "ENROLLED" },
  });
}

/**
 * When `ProgramApplication.status` becomes ENROLLED, align `StudentProfile.status` for the same
 * program enrollment (applicant’s profile `programId` must match the application).
 */
export async function syncStudentProfileWithApplicationEnrolled(
  applicantId: string,
  programId: string
): Promise<void> {
  const profile = await db.studentProfile.findUnique({
    where: { userId: applicantId },
    select: { programId: true, status: true },
  });
  if (!profile?.programId || profile.programId !== programId) return;
  if (profile.status === "ENROLLED") return;
  await db.studentProfile.update({
    where: { userId: applicantId },
    data: { status: "ENROLLED" },
  });
}
