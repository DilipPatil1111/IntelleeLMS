import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import type { Prisma } from "@/app/generated/prisma/client";
import { NextResponse } from "next/server";

export async function GET(req: Request) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const q = searchParams.get("q")?.trim();
  const programId = searchParams.get("programId") || undefined;
  const batchId = searchParams.get("batchId") || undefined;
  const teacherId = searchParams.get("teacherId") || undefined;
  const status = searchParams.get("status") || undefined;
  const type = searchParams.get("type") || undefined;

  const and: Prisma.AssessmentWhereInput[] = [];

  if (q) {
    and.push({
      OR: [
        { title: { contains: q, mode: "insensitive" } },
        { subject: { name: { contains: q, mode: "insensitive" } } },
      ],
    });
  }
  if (programId) and.push({ batch: { programId } });
  if (batchId) and.push({ batchId });
  if (teacherId) and.push({ createdById: teacherId });
  if (status) and.push({ status: status as "DRAFT" | "PUBLISHED" | "CLOSED" | "GRADED" });
  if (type) and.push({ type: type as "QUIZ" | "TEST" | "ASSIGNMENT" | "PROJECT" | "HOMEWORK" });

  const assessments = await db.assessment.findMany({
    where: and.length ? { AND: and } : undefined,
    include: {
      subject: true,
      batch: { include: { program: true } },
      creator: { select: { id: true, firstName: true, lastName: true, email: true } },
      _count: { select: { attempts: true, questions: true } },
    },
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json({ assessments });
}
