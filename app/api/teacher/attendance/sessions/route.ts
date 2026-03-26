import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { NextResponse } from "next/server";

export async function GET(req: Request) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const subjectId = searchParams.get("subjectId");
  const batchId = searchParams.get("batchId");

  const where: Record<string, unknown> = {
    createdById: session.user.id,
  };
  if (subjectId) where.subjectId = subjectId;
  if (batchId) where.batchId = batchId;

  const sessions = await db.attendanceSession.findMany({
    where,
    include: {
      subject: true,
      records: { select: { studentId: true, status: true } },
      teacherAttendance: true,
    },
    orderBy: { sessionDate: "desc" },
    take: 30,
  });

  return NextResponse.json({ sessions });
}
