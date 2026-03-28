import { db } from "@/lib/db";

/**
 * Permanently remove a student user and dependent rows (FK order safe for Postgres).
 */
export async function deleteStudentUserCascade(userId: string) {
  await db.$transaction(async (tx) => {
    await tx.attempt.deleteMany({ where: { studentId: userId } });
    await tx.assessmentAssignedStudent.deleteMany({ where: { studentId: userId } });
    await tx.attendanceRecord.deleteMany({ where: { studentId: userId } });
    await tx.topicProgress.deleteMany({ where: { studentId: userId } });
    await tx.notification.deleteMany({ where: { userId } });
    await tx.announcementRecipient.deleteMany({ where: { userId } });
    await tx.programApplication.deleteMany({ where: { applicantId: userId } });
    await tx.assessmentShare.deleteMany({
      where: { OR: [{ sharedWithId: userId }, { sharedById: userId }] },
    });
    await tx.feedback.deleteMany({
      where: {
        OR: [
          { authorId: userId },
          { aboutStudentId: userId },
          { aboutTeacherId: userId },
          { repliedById: userId },
        ],
      },
    });
    await tx.auditLog.deleteMany({ where: { userId } });

    await tx.user.update({
      where: { id: userId },
      data: { sharedDocuments: { set: [] } },
    });
    await tx.sharedDocument.deleteMany({ where: { sharedById: userId } });

    const profile = await tx.studentProfile.findUnique({
      where: { userId },
      select: { id: true },
    });
    if (profile) {
      await tx.feePayment.deleteMany({ where: { studentProfileId: profile.id } });
    }

    await tx.studentOnboarding.deleteMany({ where: { userId } });
    await tx.studentProfile.deleteMany({ where: { userId } });
    await tx.account.deleteMany({ where: { userId } });
    await tx.session.deleteMany({ where: { userId } });
    await tx.user.delete({ where: { id: userId } });
  });
}
