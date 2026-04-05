import { db } from "@/lib/db";

/**
 * Permanently remove a teacher or principal user. Reassigns authored content to `actorId`
 * where required, then deletes dependent rows in FK-safe order.
 */
export async function deleteStaffUserCascade(targetId: string, actorId: string) {
  if (targetId === actorId) {
    throw new Error("You cannot delete your own account.");
  }

  const user = await db.user.findUnique({
    where: { id: targetId },
    select: { id: true, role: true },
  });
  if (!user) throw new Error("User not found.");
  if (user.role === "STUDENT") {
    throw new Error("Use deleteStudentUserCascade for student accounts.");
  }

  if (user.role === "PRINCIPAL") {
    const principalCount = await db.user.count({ where: { role: "PRINCIPAL" } });
    if (principalCount <= 1) {
      throw new Error("Cannot delete the last administrator account.");
    }
  }

  await db.$transaction(async (tx) => {
    await tx.assessment.updateMany({
      where: { createdById: targetId },
      data: { createdById: actorId },
    });
    await tx.attendanceSession.updateMany({
      where: { createdById: targetId },
      data: { createdById: actorId },
    });
    await tx.announcement.updateMany({
      where: { createdById: targetId },
      data: { createdById: actorId },
    });
    await tx.sharedDocument.updateMany({
      where: { sharedById: targetId },
      data: { sharedById: actorId },
    });

    await tx.programApplication.deleteMany({ where: { applicantId: targetId } });

    await tx.teacherAttendance.deleteMany({ where: { teacherUserId: targetId } });
    await tx.programCalendarSlot.deleteMany({ where: { teacherUserId: targetId } });

    const tp = await tx.teacherProfile.findUnique({ where: { userId: targetId }, select: { id: true } });
    if (tp) {
      await tx.teacherSubjectAssignment.deleteMany({ where: { teacherProfileId: tp.id } });
      await tx.teacherProgram.deleteMany({ where: { teacherProfileId: tp.id } });
    }

    await tx.assessmentShare.deleteMany({
      where: { OR: [{ sharedWithId: targetId }, { sharedById: targetId }] },
    });

    await tx.feedback.updateMany({
      where: { aboutTeacherId: targetId },
      data: { aboutTeacherId: null },
    });
    await tx.feedback.deleteMany({
      where: { OR: [{ authorId: targetId }, { repliedById: targetId }] },
    });

    await tx.auditLog.deleteMany({ where: { userId: targetId } });
    await tx.notification.deleteMany({ where: { userId: targetId } });
    await tx.userPortalGrant.deleteMany({
      where: { OR: [{ userId: targetId }, { createdById: targetId }] },
    });

    const docsWithShare = await tx.sharedDocument.findMany({
      where: { sharedWith: { some: { id: targetId } } },
      select: { id: true },
    });
    for (const d of docsWithShare) {
      await tx.sharedDocument.update({
        where: { id: d.id },
        data: { sharedWith: { disconnect: { id: targetId } } },
      });
    }

    await tx.user.delete({ where: { id: targetId } });
  });
}
