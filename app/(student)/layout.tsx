import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { DashboardShell } from "@/components/layout/dashboard-shell";
import { getInitials } from "@/lib/utils";
import { db } from "@/lib/db";

/** Applied (and similar): dashboard, profile, apply, notifications — before placement / onboarding checklist. */
const PATH_APPLIED = ["/student", "/student/profile", "/student/apply", "/student/notifications", "/student/feedback"];

/**
 * Placement confirmed (ACCEPTED) with an onboarding row: onboarding + assessments + results + fees until principal unlocks → ENROLLED.
 */
const PATH_PRE_PRINCIPAL_UNLOCK = [
  "/student",
  "/student/profile",
  "/student/notifications",
  "/student/feedback",
  "/student/onboarding",
  "/student/fees",
  "/student/assessments",
  "/student/results",
];

/** Cancelled, suspended, expelled, or transferred: limited portal access. */
const PATH_RESTRICTED = ["/student", "/student/profile", "/student/notifications", "/student/fees", "/student/feedback"];

export default async function StudentLayout({ children }: { children: React.ReactNode }) {
  const session = await auth();
  if (!session?.user) redirect("/login");

  const role = (session.user as unknown as Record<string, unknown>).role as string;
  if (role !== "STUDENT") redirect("/login");

  const userId = session.user.id;

  const user = await db.user.findUnique({
    where: { id: userId },
    select: {
      profilePicture: true,
      studentProfile: { select: { status: true } },
      studentOnboarding: { select: { id: true, principalConfirmedAt: true } },
    },
  });

  const name = session.user.name || "Student";
  const parts = name.split(" ");
  const initials = getInitials(parts[0] || "S", parts[parts.length - 1] || "T");

  const sp = user?.studentProfile;
  const status = sp?.status;
  const hasOnboardingRow = !!user?.studentOnboarding;

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
  } else if (status === "APPLIED" || status === "RETAKE") {
    allowedPaths = PATH_APPLIED;
  } else if (status === "ACCEPTED") {
    /** Batch/placement confirmed and checklist row exists → onboarding phase. Otherwise still “application accepted” only. */
    allowedPaths = hasOnboardingRow ? PATH_PRE_PRINCIPAL_UNLOCK : PATH_APPLIED;
  } else if (status === "ENROLLED" || status === "GRADUATED" || status === "COMPLETED") {
    /** Fully enrolled (principal unlocked) or alumni-style statuses → full navigation. */
    allowedPaths = undefined;
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
