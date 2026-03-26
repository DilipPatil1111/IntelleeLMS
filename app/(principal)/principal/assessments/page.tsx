import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { redirect } from "next/navigation";
import { PageHeader } from "@/components/layout/page-header";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { formatDate } from "@/lib/utils";

export default async function PrincipalAssessmentsPage() {
  const session = await auth();
  if (!session?.user) redirect("/login");

  const assessments = await db.assessment.findMany({
    include: {
      subject: true,
      batch: { include: { program: true } },
      _count: { select: { attempts: true, questions: true } },
    },
    orderBy: { createdAt: "desc" },
  });

  return (
    <>
      <PageHeader title="All Assessments" description="View all assessments across the college" />
      <div className="space-y-4">
        {assessments.map((a) => (
          <Card key={a.id}>
            <CardContent>
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <h3 className="text-base font-semibold text-gray-900">{a.title}</h3>
                    <Badge variant={a.type === "QUIZ" ? "info" : a.type === "TEST" ? "warning" : "default"}>{a.type}</Badge>
                    <Badge variant={a.status === "PUBLISHED" ? "success" : a.status === "GRADED" ? "info" : "default"}>{a.status}</Badge>
                  </div>
                  <p className="text-sm text-gray-500">
                    {a.subject?.name} — {a.batch?.program?.name} — {a.batch?.name}
                  </p>
                  <p className="text-xs text-gray-400">{a._count.questions} questions — {a.totalMarks} marks — {a._count.attempts} submissions — Created {formatDate(a.createdAt)}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </>
  );
}
