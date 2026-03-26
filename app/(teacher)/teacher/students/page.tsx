import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { redirect } from "next/navigation";
import { PageHeader } from "@/components/layout/page-header";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

export default async function TeacherStudentsPage() {
  const session = await auth();
  if (!session?.user) redirect("/login");

  const user = await db.user.findUnique({
    where: { id: session.user.id },
    include: {
      teacherProfile: { include: { subjectAssignments: true } },
    },
  });

  const batchIds = [
    ...new Set(
      user?.teacherProfile?.subjectAssignments.map((a) => a.batchId) || []
    ),
  ];

  const students =
    batchIds.length > 0
      ? await db.user.findMany({
          where: {
            role: "STUDENT",
            studentProfile: { batchId: { in: batchIds } },
          },
          include: {
            studentProfile: { include: { program: true, batch: true } },
            attempts: {
              where: { status: "GRADED" },
              select: { percentage: true },
            },
            attendanceRecords: { select: { status: true } },
          },
          orderBy: { firstName: "asc" },
        })
      : [];

  return (
    <>
      <PageHeader
        title="My Students"
        description="Students in your assigned batches"
      />
      {students.length === 0 ? (
        <Card>
          <CardContent>
            <p className="text-center text-gray-500 py-8">
              No students found.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-gray-200">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium uppercase text-gray-500">
                  Name
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium uppercase text-gray-500">
                  Email
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium uppercase text-gray-500">
                  Program
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium uppercase text-gray-500">
                  Batch
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium uppercase text-gray-500">
                  Avg Score
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium uppercase text-gray-500">
                  Attendance
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 bg-white">
              {students.map((s) => {
                const avg =
                  s.attempts.length > 0
                    ? Math.round(
                        s.attempts.reduce(
                          (sum, a) => sum + (a.percentage || 0),
                          0
                        ) / s.attempts.length
                      )
                    : 0;
                const total = s.attendanceRecords.length;
                const present = s.attendanceRecords.filter(
                  (r) => r.status === "PRESENT" || r.status === "LATE"
                ).length;
                const attRate =
                  total > 0 ? Math.round((present / total) * 100) : 0;
                return (
                  <tr key={s.id}>
                    <td className="px-4 py-3 text-sm font-medium text-gray-900">
                      {s.firstName} {s.lastName}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-500">
                      {s.email}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-500">
                      {s.studentProfile?.program?.name || "—"}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-500">
                      {s.studentProfile?.batch?.name || "—"}
                    </td>
                    <td className="px-4 py-3">
                      <Badge
                        variant={
                          avg >= 50
                            ? "success"
                            : avg > 0
                              ? "danger"
                              : "default"
                        }
                      >
                        {avg}%
                      </Badge>
                    </td>
                    <td className="px-4 py-3">
                      <Badge
                        variant={
                          attRate >= 75
                            ? "success"
                            : attRate >= 50
                              ? "warning"
                              : "danger"
                        }
                      >
                        {attRate}%
                      </Badge>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}
