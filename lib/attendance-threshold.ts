import { db } from "@/lib/db";
import { sendEmailWithSignature } from "@/lib/email-signature";

const COOLDOWN_MS = 7 * 24 * 60 * 60 * 1000;

function countsTowardDenominator(status: string): boolean {
  return status === "PRESENT" || status === "ABSENT" || status === "LATE" || status === "EXCUSED";
}

function countsAsAttended(status: string): boolean {
  return status === "PRESENT" || status === "LATE" || status === "EXCUSED";
}

/**
 * Attendance % for a student within a batch: (P+L) / (P+L+A) excluding EXCUSED from denominator.
 */
export async function computeStudentBatchAttendancePercent(studentId: string, batchId: string): Promise<number | null> {
  const records = await db.attendanceRecord.findMany({
    where: {
      studentId,
      session: { batchId },
    },
    select: { status: true },
  });
  const relevant = records.filter((r) => countsTowardDenominator(r.status));
  if (relevant.length === 0) return null;
  const attended = relevant.filter((r) => countsAsAttended(r.status)).length;
  return Math.round((100 * attended) / relevant.length);
}

async function getThresholdPercentForBatch(batchId: string): Promise<number> {
  const batch = await db.batch.findUnique({
    where: { id: batchId },
    include: { program: true },
  });
  if (!batch) return 75;
  if (batch.program.minAttendancePercent != null) return batch.program.minAttendancePercent;
  const inst = await db.institutionSettings.findUnique({ where: { id: 1 } });
  return inst?.minAttendancePercent ?? 75;
}

async function shouldSendLowAttendanceAgain(studentId: string): Promise<boolean> {
  const since = new Date(Date.now() - COOLDOWN_MS);
  const existing = await db.notification.findFirst({
    where: {
      userId: studentId,
      type: "LOW_ATTENDANCE_STUDENT",
      createdAt: { gte: since },
    },
  });
  return !existing;
}

/** After attendance is saved for a batch, re-check listed students and notify if below threshold. */
export async function evaluateLowAttendanceForStudents(batchId: string, studentIds: string[]): Promise<void> {
  if (studentIds.length === 0) return;
  const threshold = await getThresholdPercentForBatch(batchId);
  const batch = await db.batch.findUnique({
    where: { id: batchId },
    include: { program: { select: { name: true } }, academicYear: { select: { name: true } } },
  });
  if (!batch) return;

  const college = process.env.NEXT_PUBLIC_COLLEGE_NAME?.trim() || "Intellee College";

  for (const studentId of [...new Set(studentIds)]) {
    const pct = await computeStudentBatchAttendancePercent(studentId, batchId);
    if (pct == null) continue;
    if (pct >= threshold) continue;

    const student = await db.user.findUnique({
      where: { id: studentId },
      select: { email: true, firstName: true, lastName: true },
    });
    if (!student) continue;

    const okCooldown = await shouldSendLowAttendanceAgain(studentId);
    if (!okCooldown) continue;

    const msg = `Your attendance is ${pct}%, below the required ${threshold}% for ${batch.program.name} (${batch.name}). Please meet your instructor or administration.`;

    await db.notification.create({
      data: {
        userId: studentId,
        type: "LOW_ATTENDANCE_STUDENT",
        title: "Low attendance warning",
        message: msg,
        link: "/student/attendance",
      },
    });

    await sendEmailWithSignature({
      to: student.email,
      subject: `${college} — Attendance below required level`,
      text: `Dear ${student.firstName},\n\n${msg}\n\n— ${college}`,
      senderUserId: null,
    });

    const staffMessage = `Student ${student.firstName} ${student.lastName} has attendance ${pct}% (threshold ${threshold}%) in batch ${batch.name}.`;

    const principals = await db.user.findMany({
      where: { role: "PRINCIPAL", isActive: true },
      select: { id: true },
    });
    for (const p of principals) {
      await db.notification.create({
        data: {
          userId: p.id,
          type: "LOW_ATTENDANCE_STAFF",
          title: "Low attendance alert",
          message: staffMessage,
          link: `/principal/attendance?batchId=${batchId}`,
        },
      });
    }

    const assignments = await db.teacherSubjectAssignment.findMany({
      where: { batchId },
      include: { teacherProfile: { select: { userId: true } } },
    });
    const teacherUserIds = [...new Set(assignments.map((a) => a.teacherProfile.userId).filter(Boolean))];
    for (const tid of teacherUserIds) {
      await db.notification.create({
        data: {
          userId: tid,
          type: "LOW_ATTENDANCE_STAFF",
          title: "Low attendance alert",
          message: staffMessage,
          link: `/teacher/attendance?view=grid`,
        },
      });
    }
  }
}
