import { requireTeacherPortal } from "@/lib/api-auth";
import { db } from "@/lib/db";
import { isTeacherOwnershipRestricted } from "@/lib/portal-access";
import type { Prisma } from "@/app/generated/prisma/client";
import { NextResponse } from "next/server";

/** Paginated grading queue (SUBMITTED / GRADED attempts for teacher's assessments). */
export async function GET(req: Request) {
  const gate = await requireTeacherPortal();
  if (!gate.ok) return gate.response;
  const session = gate.session;

  const { searchParams } = new URL(req.url);
  const assessmentId = searchParams.get("assessmentId") || undefined;
  const page = Math.max(1, Number.parseInt(searchParams.get("page") || "1", 10) || 1);
  let pageSize = Number.parseInt(searchParams.get("pageSize") || "10", 10) || 10;
  pageSize = Math.min(Math.max(1, pageSize), 50);

  const where: Prisma.AttemptWhereInput = {
    ...(isTeacherOwnershipRestricted(session) ? { assessment: { createdById: session.user.id } } : {}),
    status: { in: ["SUBMITTED", "GRADED"] },
  };
  if (assessmentId) {
    where.assessmentId = assessmentId;
  }

  const [total, attempts] = await Promise.all([
    db.attempt.count({ where }),
    db.attempt.findMany({
      where,
      include: {
        student: true,
        assessment: { include: { subject: true } },
        answers: { include: { question: { include: { options: true } } } },
      },
      orderBy: [{ status: "asc" }, { submittedAt: "desc" }],
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
  ]);

  return NextResponse.json({ attempts, total, page, pageSize });
}
