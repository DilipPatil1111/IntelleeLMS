import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { studentVisibleAssessmentFilter } from "@/lib/assessment-assigned-students";
import { redirect } from "next/navigation";
import { connection } from "next/server";
import { PageHeader } from "@/components/layout/page-header";
import { Card, CardContent } from "@/components/ui/card";
import { AssessmentsListClient } from "./assessments-list-client";

export default async function StudentAssessmentsPage() {
  await connection();
  const session = await auth();
  if (!session?.user) redirect("/login");

  const user = await db.user.findUnique({
    where: { id: session.user.id },
    include: { studentProfile: true },
  });

  if (!user?.studentProfile) {
    return (
      <>
        <PageHeader title="My Assessments" description="View and take quizzes, tests, and assignments" />
        <Card>
          <CardContent>
            <div className="text-center py-12">
              <p className="text-gray-500 mb-2">Your student profile is not set up yet.</p>
              <p className="text-sm text-gray-400">
                Please contact your teacher or administrator to assign you to a program and batch.
              </p>
            </div>
          </CardContent>
        </Card>
      </>
    );
  }

  const batchId = user.studentProfile.batchId;

  // Fetch all visible assessments (current + closed/graded) including program info
  const allAssessments = batchId
    ? await db.assessment.findMany({
        where: {
          status: { in: ["PUBLISHED", "CLOSED", "GRADED"] },
          AND: [studentVisibleAssessmentFilter(user.id, batchId)],
        },
        include: {
          subject: true,
          batch: { include: { program: true } },
          attempts: {
            where: { studentId: user.id },
            orderBy: { submittedAt: "desc" },
          },
          _count: { select: { questions: true } },
        },
        orderBy: { createdAt: "desc" },
      })
    : [];

  // Split into pending (no completed attempt) and history (submitted/graded)
  const pending = allAssessments.filter((a) => {
    const submitted = a.attempts.some((t) => t.status === "SUBMITTED" || t.status === "GRADED");
    return !submitted;
  });

  const history = allAssessments.filter((a) =>
    a.attempts.some((t) => t.status === "SUBMITTED" || t.status === "GRADED")
  );

  // Group history by program
  const historyByProgram = new Map<string, { programName: string; items: typeof history }>();
  for (const a of history) {
    const key = a.batch?.program?.id ?? "other";
    const name = a.batch?.program?.name ?? "Other Assessments";
    if (!historyByProgram.has(key)) historyByProgram.set(key, { programName: name, items: [] });
    historyByProgram.get(key)!.items.push(a);
  }

  const historyGroups = [...historyByProgram.entries()].map(([key, val]) => ({
    key,
    ...val,
  }));

  return (
    <>
      <PageHeader
        title="My Assessments"
        description="View and take quizzes, tests, and assignments"
      />
      <AssessmentsListClient
        pending={JSON.parse(JSON.stringify(pending))}
        historyByProgram={JSON.parse(JSON.stringify(historyGroups))}
      />
    </>
  );
}
