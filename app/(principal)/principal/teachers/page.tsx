import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { redirect } from "next/navigation";
import { PageHeader } from "@/components/layout/page-header";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

export default async function PrincipalTeachersPage() {
  const session = await auth();
  if (!session?.user) redirect("/login");

  const teachers = await db.user.findMany({
    where: { role: "TEACHER" },
    include: {
      teacherProfile: {
        include: {
          subjectAssignments: { include: { subject: true, batch: true } },
        },
      },
    },
    orderBy: { firstName: "asc" },
  });

  const teacherStats = await Promise.all(
    teachers.map(async (t) => {
      const assessmentCount = await db.assessment.count({ where: { createdById: t.id } });
      const gradedCount = await db.attempt.count({ where: { assessment: { createdById: t.id }, status: "GRADED" } });
      return { ...t, assessmentCount, gradedCount };
    })
  );

  return (
    <>
      <PageHeader title="All Teachers" description="View teacher assignments and performance" />
      <div className="space-y-4">
        {teacherStats.map((t) => (
          <Card key={t.id}>
            <CardContent>
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                  <h3 className="text-base font-semibold text-gray-900">{t.firstName} {t.lastName}</h3>
                  <p className="text-sm text-gray-500">{t.email} — {t.teacherProfile?.employeeId}</p>
                  {t.teacherProfile?.subjectAssignments && t.teacherProfile.subjectAssignments.length > 0 && (
                    <div className="flex flex-wrap gap-1 mt-2">
                      {t.teacherProfile.subjectAssignments.map((a) => (
                        <Badge key={a.id} variant="info">{a.subject.name} ({a.batch.name})</Badge>
                      ))}
                    </div>
                  )}
                </div>
                <div className="flex items-center gap-4 text-sm">
                  <div className="text-center">
                    <p className="text-lg font-bold text-gray-900">{t.assessmentCount}</p>
                    <p className="text-xs text-gray-500">Assessments</p>
                  </div>
                  <div className="text-center">
                    <p className="text-lg font-bold text-gray-900">{t.gradedCount}</p>
                    <p className="text-xs text-gray-500">Graded</p>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </>
  );
}
