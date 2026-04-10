import { NextResponse } from "next/server";
import { requirePrincipalPortal } from "@/lib/api-auth";
import { db } from "@/lib/db";

export async function GET() {
  const gate = await requirePrincipalPortal();
  if (!gate.ok) return gate.response;

  const requests = await db.assessmentRetakeRequest.findMany({
    include: {
      assessment: {
        select: {
          id: true,
          title: true,
          type: true,
          totalMarks: true,
          passingMarks: true,
          subject: { select: { name: true } },
          creator: { select: { firstName: true, lastName: true } },
        },
      },
      student: { select: { id: true, firstName: true, lastName: true, email: true } },
      resolvedBy: { select: { firstName: true, lastName: true } },
    },
    orderBy: { createdAt: "desc" },
  });

  const enriched = await Promise.all(
    requests.map(async (r) => {
      const attempt = await db.attempt.findFirst({
        where: { assessmentId: r.assessmentId, studentId: r.studentUserId },
        select: { totalScore: true, percentage: true },
      });
      return { ...r, attemptScore: attempt?.totalScore ?? null, attemptPercentage: attempt?.percentage ?? null };
    }),
  );

  return NextResponse.json({ requests: enriched });
}
