import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { PageHeader } from "@/components/layout/page-header";
import { StatCard } from "@/components/ui/stat-card";
import { Card, CardContent } from "@/components/ui/card";
import { Users, GraduationCap, FileText, BookOpen, TrendingUp, Calendar } from "lucide-react";
import Link from "next/link";
import { PrincipalChartsClient } from "./principal-charts-client";

export default async function PrincipalDashboard() {
  const session = await auth();
  if (!session?.user) redirect("/login");

  const [totalStudents, totalTeachers, totalAssessments, totalPrograms] = await Promise.all([
    db.user.count({ where: { role: "STUDENT" } }),
    db.user.count({ where: { role: "TEACHER" } }),
    db.assessment.count(),
    db.program.count(),
  ]);

  const gradedAttempts = await db.attempt.findMany({
    where: { status: "GRADED" },
    include: { assessment: { include: { subject: true } } },
  });

  const passCount = gradedAttempts.filter((a) => (a.percentage || 0) >= 50).length;
  const passRate = gradedAttempts.length > 0 ? Math.round((passCount / gradedAttempts.length) * 100) : 0;

  const subjectStats: Record<string, { name: string; passed: number; failed: number; avg: number; count: number }> = {};
  for (const a of gradedAttempts) {
    const sname = a.assessment.subject?.name || "Unknown";
    if (!subjectStats[sname]) subjectStats[sname] = { name: sname, passed: 0, failed: 0, avg: 0, count: 0 };
    subjectStats[sname].count++;
    subjectStats[sname].avg += a.percentage || 0;
    if ((a.percentage || 0) >= 50) subjectStats[sname].passed++;
    else subjectStats[sname].failed++;
  }

  const chartData = Object.values(subjectStats).map((s) => ({
    ...s,
    avg: s.count > 0 ? Math.round(s.avg / s.count) : 0,
  }));

  return (
    <>
      <PageHeader title="Principal Dashboard" description="Overview of all college activities and performance" />

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-6 mb-8">
        <StatCard title="Students" value={totalStudents} icon={<GraduationCap className="h-5 w-5" />} />
        <StatCard title="Teachers" value={totalTeachers} icon={<Users className="h-5 w-5" />} />
        <StatCard title="Assessments" value={totalAssessments} icon={<FileText className="h-5 w-5" />} />
        <StatCard title="Programs" value={totalPrograms} icon={<BookOpen className="h-5 w-5" />} />
        <StatCard title="Pass Rate" value={`${passRate}%`} icon={<TrendingUp className="h-5 w-5" />} />
        <StatCard title="Graded" value={gradedAttempts.length} icon={<Calendar className="h-5 w-5" />} />
      </div>

      <Suspense
        fallback={
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="h-80 rounded-xl border border-gray-200 bg-gray-50 animate-pulse" />
            <div className="h-80 rounded-xl border border-gray-200 bg-gray-50 animate-pulse" />
          </div>
        }
      >
        <PrincipalChartsClient data={chartData} />
      </Suspense>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mt-8">
        {[
          { label: "Students", href: "/principal/students", desc: "View all students and performance" },
          { label: "Teachers", href: "/principal/teachers", desc: "View teacher progress and assignments" },
          { label: "Assessments", href: "/principal/assessments", desc: "All quizzes, tests, and assignments" },
          { label: "Attendance", href: "/principal/attendance", desc: "Attendance records across all batches" },
          { label: "Programs", href: "/principal/programs", desc: "Manage programs and courses" },
          { label: "Reports", href: "/principal/reports", desc: "Detailed analytics and exports" },
        ].map((item) => (
          <Link key={item.href} href={item.href}>
            <Card className="hover:shadow-md transition-shadow cursor-pointer h-full">
              <CardContent>
                <h3 className="font-semibold text-gray-900">{item.label}</h3>
                <p className="text-sm text-gray-500 mt-1">{item.desc}</p>
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>
    </>
  );
}
