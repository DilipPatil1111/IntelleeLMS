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
 * program enrollment and ensure a ProgramEnrollment record exists.
 */
export async function syncStudentProfileWithApplicationEnrolled(
  applicantId: string,
  programId: string
): Promise<void> {
  const profile = await db.studentProfile.findUnique({
    where: { userId: applicantId },
    select: { programId: true, status: true, batchId: true, enrollmentNo: true },
  });

  await db.programEnrollment.upsert({
    where: { userId_programId: { userId: applicantId, programId } },
    update: { status: "ENROLLED" },
    create: {
      userId: applicantId,
      programId,
      batchId: profile?.batchId ?? null,
      status: "ENROLLED",
      enrollmentNo: profile?.enrollmentNo ?? null,
      enrollmentDate: new Date(),
    },
  });

  if (!profile?.programId || profile.programId !== programId) return;
  if (profile.status === "ENROLLED") return;
  await db.studentProfile.update({
    where: { userId: applicantId },
    data: { status: "ENROLLED" },
  });
}
