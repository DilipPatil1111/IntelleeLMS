import { NextResponse } from "next/server";
import { requireTeacherPortal } from "@/lib/api-auth";
import { isTeacherOwnershipRestricted } from "@/lib/portal-access";
import { db } from "@/lib/db";

export async function GET() {
  const gate = await requireTeacherPortal();
  if (!gate.ok) return gate.response;
  const session = gate.session;

  const restricted = isTeacherOwnershipRestricted(session);

  const requests = await db.assessmentRetakeRequest.findMany({
    where: {
      ...(restricted ? { assessment: { createdById: session.user.id } } : {}),
    },
    include: {
      assessment: {
        select: {
          id: true,
          title: true,
          type: true,
          totalMarks: true,
          passingMarks: true,
          subject: { select: { name: true } },
        },
      },
      student: { select: { id: true, firstName: true, lastName: true, email: true } },
      resolvedBy: { select: { firstName: true, lastName: true } },
    },
    orderBy: { createdAt: "desc" },
  });

  // Attach the student's attempt score
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
