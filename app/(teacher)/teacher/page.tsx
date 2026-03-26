import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { redirect } from "next/navigation";
import { PageHeader } from "@/components/layout/page-header";
import { StatCard } from "@/components/ui/stat-card";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { FileText, Users, ClipboardList, TrendingUp } from "lucide-react";
import { formatDate } from "@/lib/utils";
import Link from "next/link";

export default async function TeacherDashboard() {
  const session = await auth();
  if (!session?.user) redirect("/login");

  const user = await db.user.findUnique({
    where: { id: session.user.id },
    include: {
      teacherProfile: {
        include: {
          subjectAssignments: { include: { batch: true, subject: true } },
        },
      },
    },
  });

  if (!user) redirect("/login");

  const batchIds =
    user.teacherProfile?.subjectAssignments.map((a) => a.batchId) || [];
  const uniqueBatchIds = [...new Set(batchIds)];

  const totalAssessments = await db.assessment.count({
    where: { createdById: user.id },
  });
  const totalStudents =
    uniqueBatchIds.length > 0
      ? await db.studentProfile.count({
          where: { batchId: { in: uniqueBatchIds } },
        })
      : 0;

  const pendingGrading = await db.attempt.count({
    where: {
      assessment: { createdById: user.id },
      status: "SUBMITTED",
    },
  });

  const gradedAttempts = await db.attempt.findMany({
    where: { assessment: { createdById: user.id }, status: "GRADED" },
    select: {
      percentage: true,
      assessment: { select: { passingMarks: true, totalMarks: true } },
    },
  });

  const passCount = gradedAttempts.filter((a) => {
    const passThreshold = a.assessment.passingMarks
      ? (a.assessment.passingMarks / a.assessment.totalMarks) * 100
      : 50;
    return (a.percentage || 0) >= passThreshold;
  }).length;
  const passRate =
    gradedAttempts.length > 0
      ? Math.round((passCount / gradedAttempts.length) * 100)
      : 0;

  const recentAssessments = await db.assessment.findMany({
    where: { createdById: user.id },
    include: {
      subject: true,
      batch: true,
      _count: { select: { attempts: true, questions: true } },
    },
    orderBy: { createdAt: "desc" },
    take: 5,
  });

  return (
    <>
      <PageHeader
        title={`Welcome, ${user.firstName}!`}
        description="Manage your assessments, attendance, and student performance"
        actions={
          <Link href="/teacher/assessments/new">
            <Button>Create Assessment</Button>
          </Link>
        }
      />

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        <StatCard
          title="Total Assessments"
          value={totalAssessments}
          icon={<FileText className="h-5 w-5" />}
        />
        <StatCard
          title="Total Students"
          value={totalStudents}
          icon={<Users className="h-5 w-5" />}
        />
        <StatCard
          title="Pending Grading"
          value={pendingGrading}
          icon={<ClipboardList className="h-5 w-5" />}
        />
        <StatCard
          title="Pass Rate"
          value={`${passRate}%`}
          icon={<TrendingUp className="h-5 w-5" />}
        />
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>Recent Assessments</CardTitle>
            <Link
              href="/teacher/assessments"
              className="text-sm font-medium text-indigo-600 hover:text-indigo-500"
            >
              View all →
            </Link>
          </div>
        </CardHeader>
        <CardContent>
          {recentAssessments.length === 0 ? (
            <p className="text-center text-gray-500 py-8">
              No assessments created yet.
            </p>
          ) : (
            <div className="space-y-3">
              {recentAssessments.map((a) => (
                <Link
                  key={a.id}
                  href={`/teacher/assessments/${a.id}`}
                  className="flex items-center justify-between p-3 rounded-lg bg-gray-50 hover:bg-gray-100 transition-colors"
                >
                  <div>
                    <p className="text-sm font-medium text-gray-900">
                      {a.title}
                    </p>
                    <p className="text-xs text-gray-500">
                      {a.subject?.name} — {a.batch?.name} —{" "}
                      {a._count.questions} questions
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
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
                    <span className="text-xs text-gray-400">
                      {a._count.attempts} submissions
                    </span>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </>
  );
}
