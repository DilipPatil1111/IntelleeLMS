import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import Link from "next/link";
import { PageHeader } from "@/components/layout/page-header";
import { TeacherChartsClient } from "./teacher-charts-client";

export default async function TeacherReportsPage() {
  const session = await auth();
  if (!session?.user) redirect("/login");

  const teacherProfile = await db.teacherProfile.findUnique({
    where: { userId: session.user.id },
    include: { teacherPrograms: { select: { programId: true } } },
  });
  const teacherProgramIds = teacherProfile?.teacherPrograms.map((tp) => tp.programId) ?? [];
  const assessmentWhere =
    teacherProgramIds.length > 0
      ? {
          OR: [
            { createdById: session.user.id },
            { subject: { programId: { in: teacherProgramIds } } },
          ],
        }
      : { createdById: session.user.id };

  const assessments = await db.assessment.findMany({
    where: assessmentWhere,
    include: {
      subject: true,
      attempts: {
        where: { status: "GRADED" },
        select: { percentage: true, totalScore: true },
      },
    },
  });

  const chartData = assessments.map((a) => {
    const passed = a.attempts.filter(
      (t) =>
        (t.percentage || 0) >=
        (a.passingMarks && a.totalMarks > 0 ? (a.passingMarks / a.totalMarks) * 100 : 50)
    ).length;
    const failed = a.attempts.length - passed;
    const avg =
      a.attempts.length > 0
        ? Math.round(
            a.attempts.reduce((s, t) => s + (t.percentage || 0), 0) /
              a.attempts.length
          )
        : 0;
    return {
      name:
        a.title.length > 20 ? a.title.slice(0, 20) + "\u2026" : a.title,
      passed,
      failed,
      avg,
      total: a.attempts.length,
      subject: a.subject?.name || "",
    };
  });

  return (
    <>
      <PageHeader
        title="Reports"
        description="View assessment performance analytics"
      />
      <div className="mb-6 flex flex-wrap gap-4">
        <Link
          href="/teacher/reports/attendance"
          className="inline-flex items-center gap-2 rounded-lg border border-indigo-200 bg-indigo-50 px-4 py-3 text-sm font-medium text-indigo-700 hover:bg-indigo-100 transition-colors"
        >
          📊 Attendance Report
          <span className="text-xs text-indigo-500">Student-wise PDF</span>
        </Link>
        <Link
          href="/teacher/attendance?view=grid"
          className="inline-flex items-center gap-2 rounded-lg border border-gray-200 bg-gray-50 px-4 py-3 text-sm font-medium text-gray-700 hover:bg-gray-100 transition-colors"
        >
          Attendance Grid
        </Link>
      </div>
      <Suspense
        fallback={
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="h-80 rounded-xl border border-gray-200 bg-gray-50 animate-pulse" />
            <div className="h-80 rounded-xl border border-gray-200 bg-gray-50 animate-pulse" />
          </div>
        }
      >
        <TeacherChartsClient data={chartData} />
      </Suspense>
    </>
  );
}
