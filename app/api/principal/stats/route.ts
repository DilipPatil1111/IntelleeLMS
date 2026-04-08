import { requirePrincipalPortal } from "@/lib/api-auth";
import { db } from "@/lib/db";
import { NextResponse } from "next/server";

export async function GET() {
  const gate = await requirePrincipalPortal();
  if (!gate.ok) return gate.response;
  const session = gate.session;

  const [totalStudents, totalTeachers, totalAssessments, totalPrograms] = await Promise.all([
    db.user.count({ where: { role: "STUDENT" } }),
    db.user.count({ where: { role: "TEACHER" } }),
    db.assessment.count(),
    db.program.count(),
  ]);

  const gradedAttempts = await db.attempt.findMany({
    where: { status: "GRADED" },
    select: { percentage: true, assessment: { select: { passingMarks: true, totalMarks: true } } },
  });

  const passCount = gradedAttempts.filter((a) => {
    const threshold = a.assessment.passingMarks && a.assessment.totalMarks > 0 ? (a.assessment.passingMarks / a.assessment.totalMarks) * 100 : 50;
    return (a.percentage || 0) >= threshold;
  }).length;

  const overallPassRate = gradedAttempts.length > 0 ? Math.round((passCount / gradedAttempts.length) * 100) : 0;

  return NextResponse.json({
    totalStudents,
    totalTeachers,
    totalAssessments,
    totalPrograms,
    overallPassRate,
    totalGraded: gradedAttempts.length,
  });
}
