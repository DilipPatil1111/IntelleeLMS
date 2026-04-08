import { requireTeacherPortal } from "@/lib/api-auth";
import { db } from "@/lib/db";
import { NextResponse } from "next/server";

export async function GET(req: Request) {
  const gate = await requireTeacherPortal();
  if (!gate.ok) return gate.response;
  const session = gate.session;

  const { searchParams } = new URL(req.url);
  const assessmentId = searchParams.get("assessmentId");

  const where: Record<string, unknown> = { assessment: { createdById: session.user.id }, status: "GRADED" };
  if (assessmentId) where.assessmentId = assessmentId;

  const attempts = await db.attempt.findMany({
    where,
    include: {
      student: true,
      assessment: { include: { subject: true } },
    },
    orderBy: { submittedAt: "desc" },
  });

  let csv = "Student Name,Email,Assessment,Subject,Score,Total Marks,Percentage,Status,Submitted At\n";
  for (const a of attempts) {
    csv += `"${a.student.firstName} ${a.student.lastName}","${a.student.email}","${a.assessment.title}","${a.assessment.subject?.name || ""}",${a.totalScore || 0},${a.assessment.totalMarks},${a.percentage || 0}%,${a.status},"${a.submittedAt?.toISOString() || ""}"\n`;
  }

  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv",
      "Content-Disposition": `attachment; filename="results-export.csv"`,
    },
  });
}
