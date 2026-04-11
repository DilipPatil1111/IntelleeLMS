import { requirePrincipalPortal } from "@/lib/api-auth";
import { db } from "@/lib/db";
import { NextResponse } from "next/server";

export async function GET() {
  const gate = await requirePrincipalPortal();
  if (!gate.ok) return gate.response;

  const [
    totalStudents,
    totalTeachers,
    totalPrograms,
    totalBatches,
    enrolledCount,
    expelledCount,
    transferredCount,
    pendingCount,
    feeAgg,
  ] = await Promise.all([
    db.user.count({ where: { role: "STUDENT" } }),
    db.user.count({ where: { role: "TEACHER" } }),
    db.program.count(),
    db.batch.count(),
    db.studentProfile.count({ where: { status: "ENROLLED" } }),
    db.studentProfile.count({ where: { status: "EXPELLED" } }),
    db.studentProfile.count({ where: { status: "TRANSFERRED" } }),
    db.studentProfile.count({ where: { status: { in: ["APPLIED", "ACCEPTED"] } } }),
    db.feePayment.aggregate({ _sum: { amountPaid: true } }),
  ]);

  const gradedAttempts = await db.attempt.findMany({
    where: { status: "GRADED" },
    select: { percentage: true, assessment: { select: { passingMarks: true, totalMarks: true } } },
  });

  const passCount = gradedAttempts.filter((a) => {
    const threshold =
      a.assessment.passingMarks && a.assessment.totalMarks > 0
        ? (a.assessment.passingMarks / a.assessment.totalMarks) * 100
        : 50;
    return (a.percentage || 0) >= threshold;
  }).length;

  const overallPassRate = gradedAttempts.length > 0 ? Math.round((passCount / gradedAttempts.length) * 100) : 0;

  return NextResponse.json({
    totalStudents,
    totalTeachers,
    totalPrograms,
    totalBatches,
    enrolledCount,
    expelledCount,
    transferredCount,
    pendingCount,
    totalFeesReceived: feeAgg._sum.amountPaid ?? 0,
    overallPassRate,
    totalPassed: passCount,
    totalFailed: gradedAttempts.length - passCount,
    totalGraded: gradedAttempts.length,
  });
}
