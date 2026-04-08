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
      <p className="mb-6 text-sm text-gray-600">
        For attendance by program dates and batch, use the{" "}
        <Link href="/teacher/attendance?view=grid" className="font-medium text-indigo-600 hover:underline">
          attendance grid
        </Link>
        .
      </p>
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
