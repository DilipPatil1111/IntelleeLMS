import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { redirect } from "next/navigation";
import { PageHeader } from "@/components/layout/page-header";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { formatDate } from "@/lib/utils";
import Link from "next/link";

export default async function TeacherAssessmentsPage() {
  const session = await auth();
  if (!session?.user) redirect("/login");

  const assessments = await db.assessment.findMany({
    where: { createdById: session.user.id },
    include: {
      subject: true,
      batch: true,
      _count: { select: { attempts: true, questions: true } },
    },
    orderBy: { createdAt: "desc" },
  });

  return (
    <>
      <PageHeader
        title="Assessments"
        description="Create and manage quizzes, tests, and assignments"
        actions={
          <Link href="/teacher/assessments/new">
            <Button>Create New</Button>
          </Link>
        }
      />
      {assessments.length === 0 ? (
        <Card>
          <CardContent>
            <div className="text-center py-12">
              <p className="text-gray-500 mb-4">
                No assessments created yet.
              </p>
              <Link href="/teacher/assessments/new">
                <Button>Create Your First Assessment</Button>
              </Link>
            </div>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {assessments.map((a) => (
            <Card key={a.id}>
              <CardContent>
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <h3 className="text-base font-semibold text-gray-900">
                        {a.title}
                      </h3>
                      <Badge
                        variant={
                          a.type === "QUIZ"
                            ? "info"
                            : a.type === "TEST"
                              ? "warning"
                              : "default"
                        }
                      >
                        {a.type}
                      </Badge>
                      <Badge
                        variant={
                          a.status === "PUBLISHED"
                            ? "success"
                            : a.status === "DRAFT"
                              ? "default"
                              : a.status === "GRADED"
                                ? "info"
                                : "warning"
                        }
                      >
                        {a.status}
                      </Badge>
                    </div>
                    <p className="text-sm text-gray-500">
                      {a.subject?.name} — {a.batch?.name} —{" "}
                      {a._count.questions} questions — {a.totalMarks} marks
                    </p>
                    <p className="text-xs text-gray-400 mt-1">
                      Created {formatDate(a.createdAt)} —{" "}
                      {a._count.attempts} submissions
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Link href={`/teacher/assessments/${a.id}`}>
                      <Button variant="outline" size="sm">
                        View
                      </Button>
                    </Link>
                    {a.status === "DRAFT" && (
                      <Link href={`/teacher/assessments/${a.id}/edit`}>
                        <Button variant="secondary" size="sm">
                          Edit
                        </Button>
                      </Link>
                    )}
                    <Link href={`/teacher/grading?assessmentId=${a.id}`}>
                      <Button variant="ghost" size="sm">
                        Grade
                      </Button>
                    </Link>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </>
  );
}
