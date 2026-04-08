import { requirePrincipalPortal } from "@/lib/api-auth";
import { db } from "@/lib/db";
import { NextResponse } from "next/server";

export async function GET(req: Request) {
  const gate = await requirePrincipalPortal();
  if (!gate.ok) return gate.response;
  const session = gate.session;

  const { searchParams } = new URL(req.url);
  const batchId = searchParams.get("batchId");
  const subjectId = searchParams.get("subjectId");
  const programId = searchParams.get("programId");

  const where: Record<string, unknown> = {};
  if (batchId) where.batchId = batchId;
  if (subjectId) where.subjectId = subjectId;
  if (programId) where.batch = { programId };

  const sessions = await db.attendanceSession.findMany({
    where,
    include: {
      subject: true,
      batch: { include: { program: true, academicYear: true } },
      records: { include: { student: true } },
    },
    orderBy: { sessionDate: "desc" },
    take: 50,
  });

  return NextResponse.json({ sessions });
}
