import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { formatYmd } from "@/lib/day-boundaries";
import { redirect } from "next/navigation";
import { FullProgramCalendarClient } from "@/components/calendar/full-program-calendar-client";
import { PageHeader } from "@/components/layout/page-header";
import { Card, CardContent } from "@/components/ui/card";

export default async function StudentFullCalendarPage() {
  const session = await auth();
  if (!session?.user) redirect("/login");

  const profile = await db.studentProfile.findUnique({
    where: { userId: session.user.id },
    include: { program: true, batch: true },
  });

  if (!profile?.batchId) {
    return (
      <>
        <PageHeader title="Full Calendar" description="Program schedule" />
        <Card>
          <CardContent className="py-12 text-center text-gray-500">
            You are not assigned to a batch yet. When you are enrolled, your program calendar will appear here.
          </CardContent>
        </Card>
      </>
    );
  }

  const batch = profile.batch;
  const studentBatchRange =
    batch?.startDate && batch?.endDate
      ? { from: formatYmd(new Date(batch.startDate)), to: formatYmd(new Date(batch.endDate)) }
      : null;

  return (
    <FullProgramCalendarClient
      mode="student"
      fixedBatchId={profile.batchId}
      studentProgramName={profile.program?.name ?? null}
      studentBatchName={batch?.name ?? null}
      studentBatchRange={studentBatchRange}
    />
  );
}
