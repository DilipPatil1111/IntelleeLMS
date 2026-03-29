import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { redirect } from "next/navigation";

/** Course content is only for fully enrolled students (after principal onboarding unlock). */
export default async function StudentProgramLayout({ children }: { children: React.ReactNode }) {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  const sp = await db.studentProfile.findUnique({
    where: { userId: session.user.id },
    select: { status: true },
  });

  const ok =
    sp?.status === "ENROLLED" || sp?.status === "GRADUATED" || sp?.status === "COMPLETED";
  if (!ok) {
    redirect("/student");
  }

  return <>{children}</>;
}
