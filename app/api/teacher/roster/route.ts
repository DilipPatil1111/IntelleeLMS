import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import type { Prisma } from "@/app/generated/prisma/client";
import { getTeacherVisibleBatchIds } from "@/lib/teacher-visible-batches";
import { NextResponse } from "next/server";

/** Students in batches assigned to the current teacher, with optional search/filters. */
export async function GET(req: Request) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const q = searchParams.get("q")?.trim();
  const programId = searchParams.get("programId") || undefined;
  const batchId = searchParams.get("batchId") || undefined;
  const page = Math.max(1, Number.parseInt(searchParams.get("page") || "1", 10) || 1);
  let pageSize = Number.parseInt(searchParams.get("pageSize") || "15", 10) || 15;
  pageSize = Math.min(Math.max(1, pageSize), 100);

  const batchIds = await getTeacherVisibleBatchIds(session.user.id);

  const batchesMeta = await db.batch.findMany({
    where: { id: { in: batchIds } },
    select: { id: true, name: true, programId: true },
    orderBy: { name: "asc" },
  });

  if (batchIds.length === 0) {
    return NextResponse.json({
      students: [],
      batches: batchesMeta,
      total: 0,
      page: 1,
      pageSize,
    });
  }

  let allowedBatchIds = batchIds;
  if (batchId && batchIds.includes(batchId)) {
    allowedBatchIds = [batchId];
  } else if (programId) {
    const inProgram = await db.batch.findMany({
      where: { id: { in: batchIds }, programId },
      select: { id: true },
    });
    allowedBatchIds = inProgram.map((b) => b.id);
    if (allowedBatchIds.length === 0)
      return NextResponse.json({
        students: [],
        batches: batchesMeta,
        total: 0,
        page: 1,
        pageSize,
      });
  }

  const and: Prisma.UserWhereInput[] = [
    { role: "STUDENT" },
    { studentProfile: { is: { batchId: { in: allowedBatchIds } } } },
  ];

  if (q) {
    and.push({
      OR: [
        { firstName: { contains: q, mode: "insensitive" } },
        { lastName: { contains: q, mode: "insensitive" } },
        { email: { contains: q, mode: "insensitive" } },
        { studentProfile: { is: { enrollmentNo: { contains: q, mode: "insensitive" } } } },
      ],
    });
  }

  const whereFinal = { AND: and };

  const [total, students] = await Promise.all([
    db.user.count({ where: whereFinal }),
    db.user.findMany({
      where: whereFinal,
      include: {
        studentProfile: { include: { program: true, batch: true } },
        attempts: { where: { status: "GRADED" }, select: { percentage: true } },
        attendanceRecords: { select: { status: true } },
      },
      orderBy: { firstName: "asc" },
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
  ]);

  return NextResponse.json({ students, batches: batchesMeta, total, page, pageSize });
}
