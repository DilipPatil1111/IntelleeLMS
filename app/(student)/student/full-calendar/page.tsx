import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { formatYmd } from "@/lib/day-boundaries";
import { redirect } from "next/navigation";
import { PageHeader } from "@/components/layout/page-header";
import { Card, CardContent } from "@/components/ui/card";
import { FullCalendarWithHolidays } from "./full-calendar-with-holidays";

export default async function StudentFullCalendarPage() {
  const session = await auth();
  if (!session?.user) redirect("/login");

  const profile = await db.studentProfile.findUnique({
    where: { userId: session.user.id },
    include: { program: true, batch: true },
  });

  const enrollments = await db.programEnrollment.findMany({
    where: {
      userId: session.user.id,
      status: { in: ["ENROLLED", "COMPLETED", "GRADUATED"] },
    },
    include: {
      program: { select: { id: true, name: true } },
      batch: { select: { id: true, name: true, startDate: true, endDate: true } },
    },
  });

  const programsMap = new Map<string, { id: string; name: string; batchId: string | null; batchName: string | null; startDate: string | null; endDate: string | null }>();
  for (const e of enrollments) {
    programsMap.set(e.programId, {
      id: e.programId,
      name: e.program.name,
      batchId: e.batchId,
      batchName: e.batch?.name ?? null,
      startDate: e.batch?.startDate ? formatYmd(new Date(e.batch.startDate)) : null,
      endDate: e.batch?.endDate ? formatYmd(new Date(e.batch.endDate)) : null,
    });
  }
  if (profile?.programId && !programsMap.has(profile.programId)) {
    programsMap.set(profile.programId, {
      id: profile.programId,
      name: profile.program?.name ?? "Unknown",
      batchId: profile.batchId,
      batchName: profile.batch?.name ?? null,
      startDate: profile.batch?.startDate ? formatYmd(new Date(profile.batch.startDate)) : null,
      endDate: profile.batch?.endDate ? formatYmd(new Date(profile.batch.endDate)) : null,
    });
  }

  const programs = Array.from(programsMap.values());

  if (programs.length === 0 || !programs.some((p) => p.batchId)) {
    return (
      <>
        <PageHeader title="Full Calendar" description="Program schedule & holidays" />
        <Card>
          <CardContent className="py-12 text-center text-gray-500">
            You are not assigned to a batch yet. When you are enrolled, your program calendar will appear here.
          </CardContent>
        </Card>
      </>
    );
  }

  const defaultProgramId = profile?.programId ?? programs[0]?.id ?? "";

  return (
    <FullCalendarWithHolidays
      programs={programs}
      defaultProgramId={defaultProgramId}
    />
  );
}
