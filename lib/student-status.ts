import type { Prisma } from "@/app/generated/prisma/client";
import type { NotificationType, StudentStatus, SuspensionReason } from "@/app/generated/prisma/enums";
import { db } from "@/lib/db";
import { notifyPrincipalsDisciplinaryAction } from "@/lib/notify-principals";
import { sendStudentStatusChangeEmail } from "@/lib/student-status-email";

export const STUDENT_STATUS_FLOW: readonly StudentStatus[] = [
  "APPLIED",
  "ACCEPTED",
  "ENROLLED",
  "COMPLETED",
  "GRADUATED",
  "RETAKE",
  "CANCELLED",
  "SUSPENDED",
  "EXPELLED",
  "TRANSFERRED",
] as const;

export function isValidStudentStatus(s: string): s is StudentStatus {
  return (STUDENT_STATUS_FLOW as readonly string[]).includes(s);
}

function suspensionReasonLabel(r: SuspensionReason): string {
  switch (r) {
    case "FEES":
      return "non-payment or insufficient fee payment";
    case "ATTENDANCE":
      return "insufficient attendance";
    case "ACADEMIC":
      return "non-completion of compulsory academic work (assignments, tests, quizzes, or projects)";
    default:
      return "policy non-compliance";
  }
}

function getStatusChangeContent(
  previous: StudentStatus,
  next: StudentStatus,
  opts?: { suspensionReason?: SuspensionReason | null; statusNote?: string | null }
): { title: string; message: string; type: NotificationType; link: string } | null {
  if (previous === next) return null;
  const detail = opts?.statusNote?.trim();

  if (next === "CANCELLED") {
    return {
      title: "Admission cancelled",
      message: detail
        ? `Your admission has been cancelled. ${detail}`
        : "Your admission has been cancelled. Contact the office if you have questions.",
      type: "ADMISSION_CANCELLED",
      link: "/student/notifications",
    };
  }
  if (next === "SUSPENDED") {
    const reason = opts?.suspensionReason ?? "OTHER";
    const label = suspensionReasonLabel(reason);
    return {
      title: "Enrollment suspended",
      message: `Your enrollment has been suspended due to ${label}.${detail ? ` Note: ${detail}` : ""} Contact the office for next steps.`,
      type: "STUDENT_SUSPENDED",
      link: "/student/notifications",
    };
  }
  if (next === "COMPLETED") {
    return {
      title: "Requirements completed",
      message:
        "Your academic requirements for this phase have been marked complete. Check with the office if you have questions about next steps.",
      type: "GENERAL",
      link: "/student/notifications",
    };
  }
  if (next === "RETAKE") {
    return {
      title: "Retake — not continuing this intake",
      message:
        "Your status is set to retake: you are not continuing for this academic period. You may apply again for a future intake when ready.",
      type: "GENERAL",
      link: "/student/apply",
    };
  }
  if (next === "EXPELLED") {
    const d = detail ?? "";
    return {
      title: "Expelled — non-compliance / policy",
      message: d
        ? `Your enrollment has been terminated (expelled) due to non-compliance or violation of college policies. Details: ${d}`
        : "Your enrollment has been terminated (expelled). Contact the office if you have questions.",
      type: "STUDENT_EXPELLED",
      link: "/student/notifications",
    };
  }
  if (next === "TRANSFERRED") {
    const d = detail ?? "";
    return {
      title: "Transferred to another institution",
      message: d
        ? `Your record has been marked as transferred to another college or institution. Details: ${d}`
        : "Your record has been marked as transferred out of this institution. Contact the office if you have questions.",
      type: "STUDENT_TRANSFERRED",
      link: "/student/notifications",
    };
  }
  if (next === "GRADUATED") {
    return {
      title: "Graduated",
      message:
        "Congratulations — your record is marked as graduated. If a certificate is issued, you will receive a separate email.",
      type: "GENERAL",
      link: "/student/notifications",
    };
  }
  if (next === "ENROLLED") {
    return {
      title: "Full access unlocked",
      message:
        "Your principal has confirmed your onboarding. My Program, attendance, and the rest of the student portal are now available for your batch.",
      type: "GENERAL",
      link: "/student/program",
    };
  }
  if (next === "ACCEPTED") {
    return {
      title: "Application accepted",
      message:
        "Your application has been accepted. Next steps will appear in your portal; complete enrollment and onboarding as instructed.",
      type: "APPLICATION_ACCEPTED",
      link: "/student/apply",
    };
  }
  if (next === "APPLIED") {
    return {
      title: "Application status",
      message: "Your application status is recorded as Applied. You will be notified when it is reviewed.",
      type: "GENERAL",
      link: "/student/apply",
    };
  }
  const _guard: never = next;
  return _guard;
}

/** Creates in-app notification + sends email when principal changes admission status. */
export async function notifyStudentStatusChange(
  userId: string,
  previous: StudentStatus,
  next: StudentStatus,
  opts?: {
    suspensionReason?: SuspensionReason | null;
    statusNote?: string | null;
  }
) {
  const copy = getStatusChangeContent(previous, next, opts);
  if (!copy) return;

  await db.notification.create({
    data: {
      userId,
      type: copy.type,
      title: copy.title,
      message: copy.message,
      link: copy.link,
    },
  });

  if (next === "EXPELLED") {
    const detail = opts?.statusNote?.trim() ?? "";
    if (detail) {
      await notifyPrincipalsDisciplinaryAction({ studentUserId: userId, type: "EXPELLED", detail });
    }
  }
  if (next === "TRANSFERRED") {
    const detail = opts?.statusNote?.trim() ?? "";
    if (detail) {
      await notifyPrincipalsDisciplinaryAction({ studentUserId: userId, type: "TRANSFERRED", detail });
    }
  }

  const [user, profile] = await Promise.all([
    db.user.findUnique({
      where: { id: userId },
      select: { email: true, firstName: true },
    }),
    db.studentProfile.findUnique({
      where: { userId },
      select: { enrollmentNo: true, program: { select: { name: true } }, batch: { select: { name: true } } },
    }),
  ]);
  if (user?.email) {
    await sendStudentStatusChangeEmail({
      to: user.email,
      firstName: user.firstName,
      title: copy.title,
      message: copy.message,
      previousStatus: previous,
      nextStatus: next,
      programName: profile?.program?.name ?? null,
      batchName: profile?.batch?.name ?? null,
      enrollmentNo: profile?.enrollmentNo ?? null,
    });
  }
}

export type StudentProfileStatusUpdate = {
  status: StudentStatus;
  suspensionReason?: SuspensionReason | null;
  statusNote?: string | null;
};

export function buildProfileStatusData(
  next: StudentStatus,
  opts?: { suspensionReason?: SuspensionReason | null; statusNote?: string | null }
): Prisma.StudentProfileUpdateInput {
  if (next === "SUSPENDED") {
    return {
      status: next,
      suspensionReason: opts?.suspensionReason ?? "OTHER",
      statusNote: opts?.statusNote?.trim() || null,
    };
  }
  if (next === "CANCELLED" || next === "EXPELLED" || next === "TRANSFERRED") {
    return {
      status: next,
      suspensionReason: null,
      statusNote: opts?.statusNote?.trim() || null,
    };
  }
  return {
    status: next,
    suspensionReason: null,
    statusNote: null,
  };
}
