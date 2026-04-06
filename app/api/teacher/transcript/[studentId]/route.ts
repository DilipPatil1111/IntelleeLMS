import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { generateTranscriptHTML } from "@/lib/pdf";
import { formatDate } from "@/lib/utils";
import { NextResponse } from "next/server";

export async function GET(_req: Request, { params }: { params: Promise<{ studentId: string }> }) {
  const { studentId } = await params;
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const student = await db.user.findUnique({
    where: { id: studentId },
    include: {
      studentProfile: { include: { program: true, batch: true } },
      attempts: {
        where: { status: "GRADED" },
        include: { assessment: { include: { subject: true } } },
        orderBy: { submittedAt: "desc" },
      },
      attendanceRecords: true,
    },
  });

  if (!student) return NextResponse.json({ error: "Student not found" }, { status: 404 });

  const results = student.attempts.map((a) => {
    const pct = a.percentage || 0;
    const passThreshold =
      a.assessment.passingMarks && a.assessment.totalMarks > 0
        ? (a.assessment.passingMarks / a.assessment.totalMarks) * 100
        : 50;
    return {
      title: a.assessment.title,
      subject: a.assessment.subject?.name || "",
      type: a.assessment.type,
      date: formatDate(a.submittedAt || a.createdAt),
      score: a.totalScore || 0,
      totalMarks: a.assessment.totalMarks,
      percentage: pct,
      status: pct >= passThreshold ? "PASS" : "FAIL",
    };
  });

  const overallPercentage = results.length > 0
    ? Math.round(results.reduce((s, r) => s + r.percentage, 0) / results.length)
    : 0;

  const totalAtt = student.attendanceRecords.length;
  const presentAtt = student.attendanceRecords.filter((r) => r.status === "PRESENT" || r.status === "LATE").length;
  const attendanceRate = totalAtt > 0 ? Math.round((presentAtt / totalAtt) * 100) : 0;

  const html = generateTranscriptHTML({
    studentName: `${student.firstName} ${student.middleName ? student.middleName + " " : ""}${student.lastName}`,
    enrollmentNo: student.studentProfile?.enrollmentNo || "",
    program: student.studentProfile?.program?.name || "",
    batch: student.studentProfile?.batch?.name || "",
    results,
    overallPercentage,
    attendanceRate,
  });

  return new NextResponse(html, {
    headers: {
      "Content-Type": "text/html",
      "Content-Disposition": `inline; filename="transcript-${student.firstName}-${student.lastName}.html"`,
    },
  });
}
