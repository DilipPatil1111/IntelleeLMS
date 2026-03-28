import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { DashboardShell } from "@/components/layout/dashboard-shell";
import { getInitials } from "@/lib/utils";
import { db } from "@/lib/db";

/** Applied / accepted: only dashboard, profile, apply, notifications */
const PATH_APPLIED = ["/student", "/student/profile", "/student/apply", "/student/notifications", "/student/feedback"];

/**
 * Enrolled (etc.) but principal has not confirmed onboarding yet:
 * course program + attendance stay hidden; assessments and results stay available so students can complete pre-admission work.
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

  const spQuick = await db.studentProfile.findUnique({
    where: { userId },
    select: { status: true },
  });

  if (
    spQuick &&
    (spQuick.status === "ENROLLED" || spQuick.status === "GRADUATED" || spQuick.status === "COMPLETED")
  ) {
    await db.studentOnboarding.upsert({
      where: { userId },
      create: { userId },
      update: {},
    });
  }

  const user = await db.user.findUnique({
    where: { id: userId },
    select: {
      profilePicture: true,
      studentProfile: { select: { status: true } },
      studentOnboarding: {
        select: {
          principalConfirmedAt: true,
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
    /** Only active enrolled students wait on principal unlock; graduated/completed retain full portal access. */
    if (status !== "ENROLLED" || !ob || ob.principalConfirmedAt) {
      allowedPaths = undefined;
    } else {
      allowedPaths = PATH_PRE_PRINCIPAL_UNLOCK;
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
