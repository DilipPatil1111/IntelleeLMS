import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { PageHeader } from "@/components/layout/page-header";
import { StatCard } from "@/components/ui/stat-card";
import { Card, CardContent } from "@/components/ui/card";
import {
  Users,
  GraduationCap,
  BookOpen,
  TrendingUp,
  DollarSign,
  Layers,
  UserCheck,
  UserX,
  ArrowRightLeft,
  CheckCircle,
  XCircle,
  Ban,
  LogOut,
  ShieldOff,
  AlertCircle,
  ClipboardList,
  Percent,
} from "lucide-react";
import Link from "next/link";
import { PrincipalChartsClient } from "./principal-charts-client";

export default async function PrincipalDashboard() {
  const session = await auth();
  if (!session?.user) redirect("/login");

  const [
    totalStudents,
    totalTeachers,
    totalPrograms,
    totalBatches,
    programsWithCategory,
    enrolledCount,
    expelledCount,
    transferredCount,
    quittedCount,
    suspendedCount,
    totalApplicants,
    enrolledApplications,
    feePaidAgg,
    feeTotalAgg,
    gradedAttempts,
  ] = await Promise.all([
    db.user.count({ where: { role: "STUDENT" } }),
    db.user.count({ where: { role: "TEACHER" } }),
    db.program.count(),
    db.batch.count(),
    db.program.findMany({
      select: { id: true, name: true, programCategory: { select: { name: true } } },
    }),
    db.studentProfile.count({ where: { status: "ENROLLED" } }),
    db.studentProfile.count({ where: { status: "EXPELLED" } }),
    db.studentProfile.count({ where: { status: "TRANSFERRED" } }),
    db.studentProfile.count({ where: { status: "CANCELLED" } }),
    db.studentProfile.count({ where: { status: "SUSPENDED" } }),
    db.programApplication.count(),
    db.programApplication.count({ where: { status: "ENROLLED" } }),
    db.feePayment.aggregate({ _sum: { amountPaid: true } }),
    db.feeStructure.aggregate({ _sum: { totalAmount: true } }),
    db.attempt.findMany({
      where: { status: "GRADED" },
      include: {
        assessment: {
          include: {
            subject: true,
            batch: { select: { program: { select: { id: true, name: true } } } },
          },
        },
      },
    }),
  ]);

  const enrollmentRate =
    totalApplicants > 0 ? Math.round((enrolledApplications / totalApplicants) * 100) : 0;

  const vocationalCount = programsWithCategory.filter(
    (p) =>
      p.programCategory?.name?.toLowerCase().includes("vocational") &&
      !p.programCategory?.name?.toLowerCase().startsWith("non"),
  ).length;
  const nonVocationalCount = totalPrograms - vocationalCount;

  const totalFeesReceived = feePaidAgg._sum.amountPaid ?? 0;
  const totalFeesExpected = feeTotalAgg._sum.totalAmount ?? 0;
  const pendingFees = Math.max(0, totalFeesExpected - totalFeesReceived);

  const passCount = gradedAttempts.filter((a) => {
    const threshold =
      a.assessment.passingMarks && a.assessment.totalMarks > 0
        ? (a.assessment.passingMarks / a.assessment.totalMarks) * 100
        : 50;
    return (a.percentage || 0) >= threshold;
  }).length;
  const failCount = gradedAttempts.length - passCount;

  const subjectStats: Record<
    string,
    { name: string; passed: number; failed: number; avg: number; count: number }
  > = {};
  for (const a of gradedAttempts) {
    const sname = a.assessment.subject?.name || "Unknown";
    if (!subjectStats[sname])
      subjectStats[sname] = { name: sname, passed: 0, failed: 0, avg: 0, count: 0 };
    subjectStats[sname].count++;
    subjectStats[sname].avg += a.percentage || 0;
    const threshold =
      a.assessment.passingMarks && a.assessment.totalMarks > 0
        ? (a.assessment.passingMarks / a.assessment.totalMarks) * 100
        : 50;
    if ((a.percentage || 0) >= threshold) subjectStats[sname].passed++;
    else subjectStats[sname].failed++;
  }

  const chartData = Object.values(subjectStats).map((s) => ({
    ...s,
    avg: s.count > 0 ? Math.round(s.avg / s.count) : 0,
  }));

  const programStats: Record<
    string,
    { name: string; passed: number; failed: number; total: number }
  > = {};
  for (const a of gradedAttempts) {
    const pName = a.assessment.batch?.program?.name ?? "Unassigned";
    const pId = a.assessment.batch?.program?.id ?? "unassigned";
    if (!programStats[pId])
      programStats[pId] = { name: pName, passed: 0, failed: 0, total: 0 };
    programStats[pId].total++;
    const threshold =
      a.assessment.passingMarks && a.assessment.totalMarks > 0
        ? (a.assessment.passingMarks / a.assessment.totalMarks) * 100
        : 50;
    if ((a.percentage || 0) >= threshold) programStats[pId].passed++;
    else programStats[pId].failed++;
  }

  const programPassRateData = Object.values(programStats).map((p) => ({
    name: p.name,
    passRate: p.total > 0 ? Math.round((p.passed / p.total) * 100) : 0,
    passed: p.passed,
    failed: p.failed,
    total: p.total,
  }));

  const overallPassRate =
    gradedAttempts.length > 0
      ? Math.round((passCount / gradedAttempts.length) * 100)
      : 0;

  const fmtCurrency = (n: number) =>
    new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
      minimumFractionDigits: 0,
    }).format(n);

  return (
    <>
      <PageHeader
        title="Principal Dashboard"
        description="Overview of all college activities and performance"
      />

      {/* ── Row 1: Core counts ────────────────────────────────────────── */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4 mb-6">
        <StatCard
          title="Total Students"
          value={totalStudents}
          icon={<GraduationCap className="h-5 w-5" />}
          variant="indigo"
        />
        <StatCard
          title="Total Teachers"
          value={totalTeachers}
          icon={<Users className="h-5 w-5" />}
          variant="emerald"
        />
        <StatCard
          title="Total Programs"
          value={totalPrograms}
          subtitle={`V: ${vocationalCount}  ·  NV: ${nonVocationalCount}`}
          icon={<BookOpen className="h-5 w-5" />}
          variant="amber"
        />
        <StatCard
          title="Total Batches"
          value={totalBatches}
          icon={<Layers className="h-5 w-5" />}
        />
        <StatCard
          title="Total Applicants"
          value={totalApplicants}
          icon={<ClipboardList className="h-5 w-5" />}
          variant="indigo"
        />
        <StatCard
          title="Enrollment Rate"
          value={`${enrollmentRate}%`}
          subtitle={`${enrolledApplications} of ${totalApplicants} enrolled`}
          icon={<Percent className="h-5 w-5" />}
          variant={enrollmentRate >= 50 ? "emerald" : "amber"}
        />
      </div>

      {/* ── Row 2: Student status breakdown ───────────────────────────── */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-7 gap-4 mb-6">
        <StatCard
          title="Total Enrolled"
          value={enrolledCount}
          icon={<UserCheck className="h-5 w-5" />}
          variant="emerald"
        />
        <StatCard
          title="Total Expelled"
          value={expelledCount}
          icon={<Ban className="h-5 w-5" />}
          variant="rose"
        />
        <StatCard
          title="Total Transferred"
          value={transferredCount}
          icon={<ArrowRightLeft className="h-5 w-5" />}
        />
        <StatCard
          title="Total Quitted"
          value={quittedCount}
          icon={<LogOut className="h-5 w-5" />}
          variant="amber"
        />
        <StatCard
          title="Total Suspended"
          value={suspendedCount}
          icon={<ShieldOff className="h-5 w-5" />}
          variant="rose"
        />
        <StatCard
          title="Total Passed"
          value={passCount}
          subtitle={`${overallPassRate}% pass rate`}
          icon={<CheckCircle className="h-5 w-5" />}
          variant="emerald"
        />
        <StatCard
          title="Total Failed"
          value={failCount}
          icon={<XCircle className="h-5 w-5" />}
          variant="rose"
        />
      </div>

      {/* ── Row 3: Financial + Pass Rate ──────────────────────────────── */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-8">
        <StatCard
          title="Total Fees"
          value={fmtCurrency(totalFeesExpected)}
          icon={<DollarSign className="h-5 w-5" />}
          variant="indigo"
        />
        <StatCard
          title="Total Fees Collected"
          value={fmtCurrency(totalFeesReceived)}
          icon={<DollarSign className="h-5 w-5" />}
          variant="emerald"
        />
        <StatCard
          title="Total Pending Fees"
          value={fmtCurrency(pendingFees)}
          icon={<AlertCircle className="h-5 w-5" />}
          variant={pendingFees > 0 ? "amber" : "emerald"}
        />
        <StatCard
          title="Overall Pass Rate"
          value={`${overallPassRate}%`}
          subtitle={`${gradedAttempts.length} graded`}
          icon={<TrendingUp className="h-5 w-5" />}
          variant="indigo"
        />
      </div>

      {/* ── Charts ────────────────────────────────────────────────────── */}
      <Suspense
        fallback={
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="h-80 rounded-xl border border-gray-200 bg-gray-50 animate-pulse" />
            <div className="h-80 rounded-xl border border-gray-200 bg-gray-50 animate-pulse" />
          </div>
        }
      >
        <PrincipalChartsClient data={chartData} programPassRateData={programPassRateData} />
      </Suspense>

      {/* ── Quick links ───────────────────────────────────────────────── */}
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
