import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { countPendingAssessmentsForStudent } from "@/lib/student-assessment-queries";
import { redirect } from "next/navigation";
import { PageHeader } from "@/components/layout/page-header";
import { StatCard } from "@/components/ui/stat-card";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { FileText, ClipboardList, Calendar, Award } from "lucide-react";
import { formatDate } from "@/lib/utils";
import { slotDurationMinutes } from "@/lib/program-calendar-hours";
import Link from "next/link";
import { StudentJourneyProgress } from "@/components/student/student-journey-progress";
import { countIncompleteProgramContentItems } from "@/lib/program-content";
import type { StudentStatus } from "@/app/generated/prisma/enums";

export default async function StudentDashboard() {
  const session = await auth();
  if (!session?.user) redirect("/login");

  const user = await db.user.findUnique({
    where: { id: session.user.id },
    include: {
      studentProfile: { include: { program: true, batch: true } },
      studentOnboarding: { select: { principalConfirmedAt: true } },
      attempts: {
        include: { assessment: { include: { subject: true } } },
        orderBy: { createdAt: "desc" },
        take: 5,
      },
      attendanceRecords: {
        include: { session: { select: { sessionDate: true, startTime: true, endTime: true } } },
      },
    },
  });

  if (!user) redirect("/login");

  const totalAttempts = user.attempts.length;
  const gradedAttempts = user.attempts.filter((a) => a.status === "GRADED");
  const avgScore =
    gradedAttempts.length > 0
      ? Math.round(
          gradedAttempts.reduce((sum, a) => sum + (a.percentage || 0), 0) /
            gradedAttempts.length
        )
      : 0;
  const totalRecords = user.attendanceRecords.length;
  const presentRecords = user.attendanceRecords.filter(
    (r) => r.status === "PRESENT" || r.status === "LATE"
  ).length;
  const attendanceRate =
    totalRecords > 0
      ? Math.round((presentRecords / totalRecords) * 100)
      : 0;

  let attendanceTotalMinutes = 0;
  const attendanceDaySet = new Set<string>();
  for (const rec of user.attendanceRecords) {
    if (rec.status === "PRESENT" || rec.status === "LATE") {
      const mins = slotDurationMinutes(rec.session.startTime, rec.session.endTime);
      attendanceTotalMinutes += mins;
      const d = rec.session.sessionDate;
      attendanceDaySet.add(d instanceof Date ? d.toISOString().slice(0, 10) : String(d).slice(0, 10));
    }
  }
  const attendanceTotalHours = Math.round((attendanceTotalMinutes / 60) * 10) / 10;
  const attendanceTotalDays = attendanceDaySet.size;

  const pendingAssessments = await countPendingAssessmentsForStudent(
    user.id,
    user.studentProfile?.batchId ?? null
  );

  let programContentIncomplete = 0;
  if (user.studentProfile?.programId) {
    const pc = await countIncompleteProgramContentItems(user.id, user.studentProfile.programId);
    programContentIncomplete = pc.incomplete;
  }

  const journeyStatus = (user.studentProfile?.status ?? "APPLIED") as StudentStatus;

  const onboardingPhase =
    user.studentProfile?.status === "ACCEPTED" &&
    user.studentOnboarding &&
    !user.studentOnboarding.principalConfirmedAt;

  return (
    <>
      <PageHeader
        title={`Welcome, ${user.firstName}!`}
        description={
          user.studentProfile
            ? `${user.studentProfile.program?.name || "Program"} — ${user.studentProfile.batch?.name || "Batch"}`
            : "Complete your profile to get started"
        }
      />

      {onboardingPhase && (
        <div className="mb-6 rounded-xl border border-indigo-200 bg-indigo-50/90 px-4 py-4 text-sm text-indigo-950 shadow-sm">
          <p className="font-semibold">Complete your onboarding</p>
          <p className="mt-1 text-indigo-900/90">
            Your place is confirmed. Open the Onboarding section to finish the checklist steps (you can mark items complete without uploading files for now).
            When all steps are done, your principal will unlock full access including <strong>My Program</strong> and attendance.
          </p>
          <Link
            href="/student/onboarding"
            className="mt-3 inline-flex rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700"
          >
            Go to Onboarding
          </Link>
        </div>
      )}

      <StudentJourneyProgress status={journeyStatus} />

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        <StatCard
          title="Total Assessments"
          value={totalAttempts}
          icon={<FileText className="h-5 w-5" />}
          variant="indigo"
        />
        <StatCard
          title="Pending"
          value={pendingAssessments}
          icon={<ClipboardList className="h-5 w-5" />}
          variant={pendingAssessments > 0 ? "rose" : "emerald"}
        />
        <StatCard
          title="Avg. Score"
          value={`${avgScore}%`}
          icon={<Award className="h-5 w-5" />}
          variant="amber"
        />
        <StatCard
          title="Attendance"
          value={`${attendanceRate}%`}
          subtitle={`${attendanceTotalHours} hrs · ${attendanceTotalDays} day${attendanceTotalDays !== 1 ? "s" : ""}`}
          icon={<Calendar className="h-5 w-5" />}
          variant={attendanceRate >= 75 ? "emerald" : "rose"}
        />
      </div>

      {pendingAssessments > 0 && (
        <div className="mb-6 rounded-lg bg-red-50 border-2 border-red-300 p-4 flex items-center justify-between">
          <div>
            <p className="text-red-700 font-bold text-sm">⚠ You have {pendingAssessments} pending assessment{pendingAssessments > 1 ? "s" : ""}!</p>
            <p className="text-red-500 text-xs mt-1">Please complete your pending quizzes, tests, or assignments.</p>
          </div>
          <a href="/student/assessments" className="rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700">View Assessments</a>
        </div>
      )}

      {programContentIncomplete > 0 && (
        <div className="mb-6 rounded-lg border border-amber-300 bg-amber-50 p-4 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-amber-900 font-semibold text-sm">
              Program content: {programContentIncomplete} lesson{programContentIncomplete > 1 ? "s" : ""} remaining
            </p>
            <p className="text-amber-800/90 text-xs mt-0.5">
              Complete chapters and lessons under Program Content (including any mandatory quizzes in Assessments).
            </p>
          </div>
          <Link
            href="/student/program-content"
            className="inline-flex shrink-0 rounded-lg bg-amber-600 px-4 py-2 text-sm font-medium text-white hover:bg-amber-700"
          >
            Open Program Content
          </Link>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle>Recent Assessments</CardTitle>
          </CardHeader>
          <CardContent>
            {user.attempts.length === 0 ? (
              <p className="text-sm text-gray-500">
                No assessments taken yet.
              </p>
            ) : (
              <div className="space-y-3">
                {user.attempts.map((attempt) => (
                  <div
                    key={attempt.id}
                    className="flex items-center justify-between p-3 rounded-xl border border-gray-100 bg-gray-50/50 hover:bg-white hover:shadow-sm transition-all"
                  >
                    <div>
                      <p className="text-sm font-medium text-gray-900">
                        {attempt.assessment.title}
                      </p>
                      <p className="text-xs text-gray-500">
                        {attempt.assessment.subject?.name} —{" "}
                        {formatDate(attempt.createdAt)}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      {attempt.status === "GRADED" ? (
                        <Badge
                          variant={
                            attempt.percentage && attempt.percentage >= 50
                              ? "success"
                              : "danger"
                          }
                          dot
                        >
                          {attempt.percentage}%
                        </Badge>
                      ) : (
                        <Badge variant="warning" dot>
                          {attempt.status === "SUBMITTED"
                            ? "Pending"
                            : "In Progress"}
                        </Badge>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
            <Link
              href="/student/assessments"
              className="block mt-4 text-sm font-medium text-indigo-600 hover:text-indigo-500"
            >
              View all assessments →
            </Link>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Quick Links</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 gap-3">
              {[
                { label: "My Profile", href: "/student/profile", icon: "👤", color: "from-indigo-50 to-white border-indigo-100" },
                { label: "Assessments", href: "/student/assessments", icon: "📝", color: "from-violet-50 to-white border-violet-100" },
                { label: "Results", href: "/student/results", icon: "🏆", color: "from-amber-50 to-white border-amber-100" },
                { label: "Attendance", href: "/student/attendance", icon: "📅", color: "from-emerald-50 to-white border-emerald-100" },
                { label: "Fees", href: "/student/fees", icon: "💰", color: "from-green-50 to-white border-green-100" },
                { label: "Notifications", href: "/student/notifications", icon: "🔔", color: "from-sky-50 to-white border-sky-100" },
                { label: "Feedback", href: "/student/feedback", icon: "💬", color: "from-rose-50 to-white border-rose-100" },
              ].map((link) => (
                <Link
                  key={link.href}
                  href={link.href}
                  className={`flex items-center gap-3 p-3 rounded-xl border bg-gradient-to-br ${link.color} hover:shadow-md transition-all duration-200`}
                >
                  <span className="text-xl">{link.icon}</span>
                  <span className="text-sm font-semibold text-gray-700">
                    {link.label}
                  </span>
                </Link>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </>
  );
}
