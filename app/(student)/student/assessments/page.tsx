import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { findAssessmentsForStudentList } from "@/lib/student-assessment-queries";
import { redirect } from "next/navigation";
import { connection } from "next/server";
import { PageHeader } from "@/components/layout/page-header";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { formatDate } from "@/lib/utils";
import Link from "next/link";

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
        <Card><CardContent>
          <div className="text-center py-12">
            <p className="text-gray-500 mb-2">Your student profile is not set up yet.</p>
            <p className="text-sm text-gray-400">Please contact your teacher or administrator to assign you to a program and batch.</p>
          </div>
        </CardContent></Card>
      </>
    );
  }

  const assessments = await findAssessmentsForStudentList(user.id, user.studentProfile.batchId);

  return (
    <>
      <PageHeader
        title="My Assessments"
        description="View and take quizzes, tests, and assignments"
      />
      {assessments.length === 0 ? (
        <Card>
          <CardContent>
            <p className="text-center text-gray-500 py-8">
              No assessments available yet.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {assessments.map((assessment) => {
            const attempt = assessment.attempts[0];
            const isAvailable =
              assessment.status === "PUBLISHED" && !attempt;
            const isInProgress = attempt?.status === "IN_PROGRESS";

            return (
              <Card key={assessment.id}>
                <CardContent>
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <h3 className="text-base font-semibold text-gray-900">
                          {assessment.title}
                        </h3>
                        <Badge
                          variant={
                            assessment.type === "QUIZ"
                              ? "info"
                              : assessment.type === "TEST"
                                ? "warning"
                                : assessment.type === "ASSIGNMENT"
                                  ? "default"
                                  : "success"
                          }
                        >
                          {assessment.type}
                        </Badge>
                      </div>
                      <p className="text-sm text-gray-500">
                        {assessment.subject?.name} —{" "}
                        {assessment._count.questions} questions —{" "}
                        {assessment.totalMarks} marks
                      </p>
                      {assessment.scheduledCloseAt && (
                        <p className="text-xs text-gray-400 mt-1">
                          Due: {formatDate(assessment.scheduledCloseAt)}
                        </p>
                      )}
                    </div>
                    <div className="flex flex-wrap items-center justify-end gap-2 sm:gap-3">
                      {attempt && (
                        <Link
                          href={`/student/assessments/${assessment.id}/results`}
                          className="rounded-lg border border-indigo-200 bg-white px-4 py-2 text-sm font-medium text-indigo-700 shadow-sm hover:bg-indigo-50"
                        >
                          Detailed results
                        </Link>
                      )}
                      {attempt?.status === "GRADED" ? (
                        <Badge
                          variant={
                            attempt.percentage && attempt.percentage >= 50
                              ? "success"
                              : "danger"
                          }
                        >
                          Score: {attempt.percentage}%
                        </Badge>
                      ) : attempt?.status === "SUBMITTED" ? (
                        <Badge variant="warning">
                          Submitted — Pending Grade
                        </Badge>
                      ) : isInProgress ? (
                        <Link
                          href={`/student/assessments/${assessment.id}/take`}
                          className="rounded-lg bg-yellow-500 px-4 py-2 text-sm font-medium text-white hover:bg-yellow-600"
                        >
                          Continue
                        </Link>
                      ) : isAvailable ? (
                        <Link
                          href={`/student/assessments/${assessment.id}/take`}
                          className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700"
                        >
                          Start
                        </Link>
                      ) : (
                        <Badge>Closed</Badge>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </>
  );
}
