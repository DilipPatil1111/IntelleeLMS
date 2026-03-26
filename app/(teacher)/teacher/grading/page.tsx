import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { redirect } from "next/navigation";
import { PageHeader } from "@/components/layout/page-header";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { formatDateTime } from "@/lib/utils";
import Link from "next/link";

export default async function GradingPage({
  searchParams,
}: {
  searchParams: Promise<{ assessmentId?: string }>;
}) {
  const { assessmentId } = await searchParams;
  const session = await auth();
  if (!session?.user) redirect("/login");

  const where: Record<string, unknown> = {
    assessment: { createdById: session.user.id },
    status: { in: ["SUBMITTED", "GRADED"] },
  };
  if (assessmentId) {
    (where as Record<string, unknown>).assessmentId = assessmentId;
  }

  const attempts = await db.attempt.findMany({
    where,
    include: {
      student: true,
      assessment: { include: { subject: true } },
      answers: { include: { question: { include: { options: true } } } },
    },
    orderBy: [{ status: "asc" }, { submittedAt: "desc" }],
  });

  return (
    <>
      <PageHeader
        title="Grading Queue"
        description="Review and grade student submissions"
      />
      {attempts.length === 0 ? (
        <Card>
          <CardContent>
            <p className="text-center text-gray-500 py-8">
              No submissions to grade.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {attempts.map((attempt) => (
            <Card key={attempt.id}>
              <CardContent>
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <h3 className="text-sm font-semibold text-gray-900">
                        {attempt.student.firstName} {attempt.student.lastName}
                      </h3>
                      <Badge
                        variant={
                          attempt.status === "GRADED" ? "success" : "warning"
                        }
                      >
                        {attempt.status}
                      </Badge>
                    </div>
                    <p className="text-xs text-gray-500">
                      {attempt.assessment.title} —{" "}
                      {attempt.assessment.subject?.name}
                      {attempt.submittedAt &&
                        ` — Submitted ${formatDateTime(attempt.submittedAt)}`}
                    </p>
                    {attempt.totalScore !== null && (
                      <p className="text-xs text-gray-500 mt-1">
                        Score: {attempt.totalScore}/
                        {attempt.assessment.totalMarks} ({attempt.percentage}%)
                      </p>
                    )}
                  </div>
                  <Link href={`/teacher/grading/${attempt.id}`}>
                    <button className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700">
                      {attempt.status === "GRADED" ? "Review" : "Grade"}
                    </button>
                  </Link>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </>
  );
}
