import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { redirect } from "next/navigation";
import Link from "next/link";
import { computeStudentBatchAttendancePercent } from "@/lib/attendance-threshold";
import { PageHeader } from "@/components/layout/page-header";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { StatCard } from "@/components/ui/stat-card";
import { formatDate } from "@/lib/utils";
import { Calendar, CheckCircle2, XCircle, Clock } from "lucide-react";

export default async function StudentAttendancePage() {
  const session = await auth();
  if (!session?.user) redirect("/login");

  const profile = await db.studentProfile.findUnique({
    where: { userId: session.user.id },
    include: { program: true, batch: true },
  });

  const inst = await db.institutionSettings.findUnique({ where: { id: 1 } });
  const requiredPct =
    profile?.program?.minAttendancePercent ?? inst?.minAttendancePercent ?? 75;
  const batchPct = profile?.batchId
    ? await computeStudentBatchAttendancePercent(session.user.id, profile.batchId)
    : null;

  const records = await db.attendanceRecord.findMany({
    where: { studentId: session.user.id },
    include: {
      session: { include: { subject: true } },
    },
    orderBy: { session: { sessionDate: "desc" } },
  });

  const total = records.length;
  const present = records.filter((r) => r.status === "PRESENT").length;
  const late = records.filter((r) => r.status === "LATE").length;
  const absent = records.filter((r) => r.status === "ABSENT").length;
  const rate =
    total > 0 ? Math.round(((present + late) / total) * 100) : 0;

  return (
    <>
      <PageHeader
        title="My Attendance"
        description="Track your attendance across all subjects"
      />
      {profile?.program && (
        <div className="mb-6 rounded-xl border border-indigo-100 bg-indigo-50/80 px-4 py-3 text-sm text-indigo-950">
          <p>
            <strong>{profile.program.name}</strong>
            {profile.batch && <> — {profile.batch.name}</>}
          </p>
          <p className="mt-1">
            Required attendance: <strong>{requiredPct}%</strong>
            {batchPct != null && (
              <>
                {" "}
                · Your batch attendance: <strong>{batchPct}%</strong>
                {batchPct < requiredPct ? (
                  <span className="text-red-700 font-medium"> (below requirement)</span>
                ) : (
                  <span className="text-emerald-800"> (meeting requirement)</span>
                )}
              </>
            )}
          </p>
          <Link href="/student/full-calendar" className="mt-2 inline-block text-indigo-700 underline font-medium">
            View Full Calendar
          </Link>
        </div>
      )}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        <StatCard
          title="Total Sessions"
          value={total}
          icon={<Calendar className="h-5 w-5" />}
        />
        <StatCard
          title="Present"
          value={present}
          icon={<CheckCircle2 className="h-5 w-5" />}
        />
        <StatCard
          title="Late"
          value={late}
          icon={<Clock className="h-5 w-5" />}
        />
        <StatCard
          title="Attendance Rate"
          value={`${rate}%`}
          icon={<CheckCircle2 className="h-5 w-5" />}
        />
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Attendance History</CardTitle>
        </CardHeader>
        <CardContent>
          {records.length === 0 ? (
            <p className="text-center text-gray-500 py-8">
              No attendance records found.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-medium uppercase text-gray-500">
                      Date
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium uppercase text-gray-500">
                      Subject
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium uppercase text-gray-500">
                      Time
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium uppercase text-gray-500">
                      Status
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200 bg-white">
                  {records.map((record) => (
                    <tr key={record.id}>
                      <td className="px-4 py-3 text-sm text-gray-900">
                        {formatDate(record.session.sessionDate)}
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-900">
                        {record.session.subject?.name}
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-500">
                        {record.session.startTime || "—"} -{" "}
                        {record.session.endTime || "—"}
                      </td>
                      <td className="px-4 py-3">
                        <Badge
                          variant={
                            record.status === "PRESENT"
                              ? "success"
                              : record.status === "LATE"
                                ? "warning"
                                : record.status === "EXCUSED"
                                  ? "info"
                                  : "danger"
                          }
                        >
                          {record.status}
                        </Badge>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </>
  );
}
