import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { NextResponse } from "next/server";

export async function GET(req: Request) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const programId = searchParams.get("programId");
  const batchId = searchParams.get("batchId");

  const sessionWhere: Record<string, unknown> = {};
  if (batchId) sessionWhere.batchId = batchId;
  if (programId) sessionWhere.batch = { programId };

  const rows = await db.teacherAttendance.findMany({
    where: Object.keys(sessionWhere).length ? { session: sessionWhere } : {},
    include: {
      teacher: { select: { id: true, firstName: true, lastName: true, email: true } },
      session: {
        include: {
          subject: true,
          batch: { include: { program: true, academicYear: true } },
        },
      },
    },
    orderBy: { createdAt: "desc" },
    take: 100,
  });

  return NextResponse.json({ records: rows });
}
