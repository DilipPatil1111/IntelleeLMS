import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
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

  // Collect ALL batch IDs from primary profile + enrollments
  const allBatchIds = new Set<string>();
  if (user.studentProfile.batchId) allBatchIds.add(user.studentProfile.batchId);

  const enrollments = await db.programEnrollment.findMany({
    where: { userId: user.id, status: { in: ["ENROLLED", "COMPLETED", "GRADUATED"] } },
    select: { batchId: true },
  });
  for (const e of enrollments) {
    if (e.batchId) allBatchIds.add(e.batchId);
  }

  const batchIdArray = [...allBatchIds];

  // Fetch all visible assessments across ALL enrolled batches
  const allAssessments = batchIdArray.length > 0
    ? await db.assessment.findMany({
        where: {
          status: { in: ["PUBLISHED", "CLOSED", "GRADED"] },
          batchId: { in: batchIdArray },
          OR: [
            { assignedStudents: { none: {} } },
            { assignedStudents: { some: { studentId: user.id } } },
          ],
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

  // Fetch retake requests for this student (safe if table doesn't exist yet)
  let retakeMap = new Map<string, string>();
  try {
    const retakeRequests = await db.assessmentRetakeRequest.findMany({
      where: { studentUserId: user.id },
      select: { assessmentId: true, status: true },
    });
    retakeMap = new Map(retakeRequests.map((r) => [r.assessmentId, r.status]));
  } catch {
    // Table may not exist yet before migration runs
  }

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
        retakeStatuses={Object.fromEntries(retakeMap)}
      />
    </>
  );
}
