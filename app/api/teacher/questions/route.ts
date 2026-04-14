import { requireTeacherPortal } from "@/lib/api-auth";
import { db } from "@/lib/db";
import type { Prisma } from "@/app/generated/prisma/client";
import { NextResponse } from "next/server";

export async function GET(req: Request) {
  const gate = await requireTeacherPortal();
  if (!gate.ok) return gate.response;
  const session = gate.session;

  const { searchParams } = new URL(req.url);
  const q = searchParams.get("q")?.trim();
  const subject = searchParams.get("subject")?.trim();
  const type = searchParams.get("type")?.trim();
  const page = Math.max(1, Number.parseInt(searchParams.get("page") || "1", 10) || 1);
  let pageSize = Number.parseInt(searchParams.get("pageSize") || "10", 10) || 10;
  pageSize = Math.min(Math.max(1, pageSize), 50);

  const assessmentWhere: Prisma.AssessmentWhereInput = {
    createdById: session.user.id,
  };
  if (subject) {
    assessmentWhere.subject = { name: subject };
  }

  const and: Prisma.QuestionWhereInput[] = [{ assessment: assessmentWhere }];
  if (type && ["MCQ", "SHORT", "PARAGRAPH"].includes(type)) {
    and.push({ type: type as "MCQ" | "SHORT" | "PARAGRAPH" });
  }
  if (q) {
    and.push({
      OR: [
        { questionText: { contains: q, mode: "insensitive" } },
        { assessment: { title: { contains: q, mode: "insensitive" } } },
      ],
    });
  }

  const where: Prisma.QuestionWhereInput = { AND: and };

  const subjectRows = await db.subject.findMany({
    where: { assessments: { some: { createdById: session.user.id } } },
    select: { name: true },
  });
  const subjects = [...new Set(subjectRows.map((r) => r.name))].sort();

  const [total, questions] = await Promise.all([
    db.question.count({ where }),
    db.question.findMany({
      where,
      include: { assessment: { include: { subject: true } }, options: true },
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
  ]);

  return NextResponse.json({ questions, total, page, pageSize, subjects });
}
