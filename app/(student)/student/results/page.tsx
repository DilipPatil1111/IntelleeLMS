import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { redirect } from "next/navigation";
import { PageHeader } from "@/components/layout/page-header";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { formatDate } from "@/lib/utils";

export default async function StudentResultsPage() {
  const session = await auth();
  if (!session?.user) redirect("/login");

  const attempts = await db.attempt.findMany({
    where: {
      studentId: session.user.id,
      status: { in: ["SUBMITTED", "GRADED"] },
    },
    include: {
      assessment: { include: { subject: true } },
      answers: true,
    },
    orderBy: { submittedAt: "desc" },
  });

  return (
    <>
      <PageHeader
        title="My Results"
        description="View your assessment results and scores"
      />
      {attempts.length === 0 ? (
        <Card>
          <CardContent>
            <p className="text-center text-gray-500 py-8">No results yet.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {attempts.map((attempt) => (
            <Card key={attempt.id}>
              <CardContent>
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div>
                    <h3 className="text-base font-semibold text-gray-900">
                      {attempt.assessment.title}
                    </h3>
                    <p className="text-sm text-gray-500">
                      {attempt.assessment.subject?.name} —{" "}
                      {attempt.assessment.type} —{" "}
                      {formatDate(attempt.submittedAt || attempt.createdAt)}
                    </p>
                  </div>
                  <div className="flex items-center gap-3">
                    {attempt.status === "GRADED" ? (
                      <>
                        <div className="text-right">
                          <p className="text-2xl font-bold text-gray-900">
                            {attempt.totalScore}/{attempt.assessment.totalMarks}
                          </p>
                          <p className="text-xs text-gray-500">
                            {attempt.percentage}%
                          </p>
                        </div>
                        <Badge
                          variant={
                            attempt.percentage &&
                            attempt.percentage >=
                              (attempt.assessment.passingMarks
                                ? (attempt.assessment.passingMarks /
                                    attempt.assessment.totalMarks) *
                                  100
                                : 50)
                              ? "success"
                              : "danger"
                          }
                        >
                          {attempt.percentage &&
                          attempt.percentage >=
                            (attempt.assessment.passingMarks
                              ? (attempt.assessment.passingMarks /
                                  attempt.assessment.totalMarks) *
                                100
                              : 50)
                            ? "PASS"
                            : "FAIL"}
                        </Badge>
                      </>
                    ) : (
                      <Badge variant="warning">Awaiting Grade</Badge>
                    )}
                  </div>
                </div>
                {attempt.feedback && (
                  <div className="mt-3 pt-3 border-t border-gray-100">
                    <p className="text-sm text-gray-600">
                      <span className="font-medium">Feedback:</span>{" "}
                      {attempt.feedback}
                    </p>
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </>
  );
}
