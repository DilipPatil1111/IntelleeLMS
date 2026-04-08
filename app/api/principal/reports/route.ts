import { requirePrincipalPortal } from "@/lib/api-auth";
import { db } from "@/lib/db";
import { NextResponse } from "next/server";

export async function GET(req: Request) {
  const gate = await requirePrincipalPortal();
  if (!gate.ok) return gate.response;
  const session = gate.session;

  const { searchParams } = new URL(req.url);
  const programId = searchParams.get("programId");
  const batchId = searchParams.get("batchId");
  const subjectId = searchParams.get("subjectId");

  const where: Record<string, unknown> = {};
  if (subjectId) where.subjectId = subjectId;
  if (batchId) where.batchId = batchId;
  if (programId) where.batch = { programId };

  const assessments = await db.assessment.findMany({
    where,
    include: {
      subject: true,
      batch: { include: { program: true } },
      attempts: { where: { status: "GRADED" }, select: { percentage: true, totalScore: true } },
    },
    orderBy: { createdAt: "desc" },
  });

  const data = assessments.map((a) => {
    const passed = a.attempts.filter((t) => (t.percentage || 0) >= (a.passingMarks && a.totalMarks > 0 ? (a.passingMarks / a.totalMarks) * 100 : 50)).length;
    const avg = a.attempts.length > 0 ? Math.round(a.attempts.reduce((s, t) => s + (t.percentage || 0), 0) / a.attempts.length) : 0;
    return {
      id: a.id,
      title: a.title,
      subject: a.subject?.name || "",
      batch: a.batch?.name || "",
      program: a.batch?.program?.name || "",
      type: a.type,
      totalStudents: a.attempts.length,
      passed,
      failed: a.attempts.length - passed,
      avgScore: avg,
    };
  });

  return NextResponse.json({ data });
}
