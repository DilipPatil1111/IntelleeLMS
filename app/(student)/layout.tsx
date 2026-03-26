import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { DashboardShell } from "@/components/layout/dashboard-shell";
import { getInitials } from "@/lib/utils";
import { db } from "@/lib/db";

const RESTRICTED_PATHS = ["/student", "/student/profile", "/student/apply", "/student/notifications"];

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
    },
  });

  const name = session.user.name || "Student";
  const parts = name.split(" ");
  const initials = getInitials(parts[0] || "S", parts[parts.length - 1] || "T");

  const status = user?.studentProfile?.status;
  const isRestricted = status === "APPLICANT" || status === "ACCEPTED";
  const allowedPaths = isRestricted ? RESTRICTED_PATHS : undefined;

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
