import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { DashboardShell } from "@/components/layout/dashboard-shell";
import { getInitials } from "@/lib/utils";
import { db } from "@/lib/db";

/** Applied / accepted: only dashboard, profile, apply, notifications */
const PATH_APPLIED = ["/student", "/student/profile", "/student/apply", "/student/notifications", "/student/feedback"];

/** Enrolled but onboarding not finished: applicant paths + onboarding + fees */
const PATH_ONBOARDING = [...PATH_APPLIED, "/student/onboarding", "/student/fees"];

/** Cancelled, suspended, expelled, or transferred: limited portal access. */
const PATH_RESTRICTED = ["/student", "/student/profile", "/student/notifications", "/student/fees", "/student/feedback"];

/** All four student checklist steps (order-independent). Missing row = legacy user → full access. */
function studentFourStepsComplete(
  ob: {
    contractAcknowledgedAt: Date | null;
    governmentIdsUploadedAt: Date | null;
    feeProofUploadedAt: Date | null;
    preAdmissionCompletedAt: Date | null;
  } | null
): boolean {
  if (!ob) return true;
  return !!(
    ob.contractAcknowledgedAt &&
    ob.governmentIdsUploadedAt &&
    ob.feeProofUploadedAt &&
    ob.preAdmissionCompletedAt
  );
}

export default async function StudentLayout({ children }: { children: React.ReactNode }) {
  const session = await auth();
  if (!session?.user) redirect("/login");

  const role = (session.user as unknown as Record<string, unknown>).role as string;
  if (role !== "STUDENT") redirect("/login");

  const user = await db.user.findUnique({
    where: { id: session.user.id },
    select: {
      profilePicture: true,
      studentProfile: { select: { status: true } },
      studentOnboarding: {
        select: {
          contractAcknowledgedAt: true,
          governmentIdsUploadedAt: true,
          feeProofUploadedAt: true,
          preAdmissionCompletedAt: true,
        },
      },
    },
  });

  const name = session.user.name || "Student";
  const parts = name.split(" ");
  const initials = getInitials(parts[0] || "S", parts[parts.length - 1] || "T");

  const sp = user?.studentProfile;
  const status = sp?.status;

  let allowedPaths: string[] | undefined;

  if (!sp) {
    allowedPaths = PATH_APPLIED;
  } else if (
    status === "SUSPENDED" ||
    status === "CANCELLED" ||
    status === "EXPELLED" ||
    status === "TRANSFERRED"
  ) {
    allowedPaths = PATH_RESTRICTED;
  } else if (status === "APPLIED" || status === "ACCEPTED" || status === "RETAKE") {
    allowedPaths = PATH_APPLIED;
  } else if (status === "ENROLLED" || status === "GRADUATED" || status === "COMPLETED") {
    const ob = user?.studentOnboarding;
    if (!ob || studentFourStepsComplete(ob)) {
      allowedPaths = undefined;
    } else {
      allowedPaths = PATH_ONBOARDING;
    }
  } else {
    allowedPaths = undefined;
  }

  return (
    <DashboardShell
      role="student"
      userName={name}
      userInitials={initials}
      profilePicture={user?.profilePicture ?? undefined}
      allowedPaths={allowedPaths}
    >
      {children}
    </DashboardShell>
  );
}
