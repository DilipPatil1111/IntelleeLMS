import { db } from "@/lib/db";

/** Notify principals once when all four onboarding checklist timestamps are set (upload or mark complete). */
export async function notifyPrincipalsIfOnboardingChecklistJustCompleted(
  studentUserId: string,
  wasCompleteBefore: boolean
) {
  if (wasCompleteBefore) return;

  const updated = await db.studentOnboarding.findUnique({
    where: { userId: studentUserId },
    select: {
      contractAcknowledgedAt: true,
      governmentIdsUploadedAt: true,
      feeProofUploadedAt: true,
      preAdmissionCompletedAt: true,
    },
  });
  if (
    !updated?.contractAcknowledgedAt ||
    !updated.governmentIdsUploadedAt ||
    !updated.feeProofUploadedAt ||
    !updated.preAdmissionCompletedAt
  ) {
    return;
  }

  const student = await db.user.findUnique({
    where: { id: studentUserId },
    select: { firstName: true, lastName: true },
  });
  const name = student ? `${student.firstName} ${student.lastName}` : "A student";
  const principals = await db.user.findMany({ where: { role: "PRINCIPAL" }, select: { id: true } });
  if (principals.length === 0) return;

  await db.notification.createMany({
    data: principals.map((p) => ({
      userId: p.id,
      type: "ONBOARDING_STUDENT_COMPLETED" as const,
      title: "Student ready to unlock",
      message: `${name} completed all onboarding checklist steps. Open Onboarding review to confirm and set them to Enrolled.`,
      link: "/principal/onboarding-review",
    })),
  });
}
