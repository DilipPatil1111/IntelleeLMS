import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { NextResponse } from "next/server";

export async function GET(req: Request) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const batchId = searchParams.get("batchId");
  const subjectId = searchParams.get("subjectId");

  const where: Record<string, unknown> = {};
  if (batchId) where.batchId = batchId;
  if (subjectId) where.subjectId = subjectId;

  const sessions = await db.attendanceSession.findMany({
    where,
    include: {
      subject: true,
      batch: true,
      records: { include: { student: true } },
    },
    orderBy: { sessionDate: "desc" },
    take: 50,
  });

  return NextResponse.json({ sessions });
}
