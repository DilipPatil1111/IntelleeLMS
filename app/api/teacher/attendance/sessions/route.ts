import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { hasTeacherPortalAccess } from "@/lib/portal-access";
import { getTeacherVisibleBatchIds } from "@/lib/teacher-visible-batches";
import { NextResponse } from "next/server";
import type { Prisma } from "@/app/generated/prisma/client";

const DEFAULT_PAGE_SIZE = 12;
const MAX_PAGE_SIZE = 50;

export async function GET(req: Request) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!hasTeacherPortalAccess(session)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { searchParams } = new URL(req.url);
  const subjectId = searchParams.get("subjectId");
  const batchId = searchParams.get("batchId");
  const pageRaw = searchParams.get("page");
  const pageSizeRaw = searchParams.get("pageSize");

  if (!subjectId || !batchId) {
    return NextResponse.json(
      { error: "subjectId and batchId are required" },
      { status: 400 }
    );
  }

  const allowedBatchIds = await getTeacherVisibleBatchIds(session.user.id, session);
  const hasBatchVisibility = allowedBatchIds.includes(batchId);
  if (!hasBatchVisibility) {
    const ownSession = await db.attendanceSession.findFirst({
      where: { subjectId, batchId, createdById: session.user.id },
      select: { id: true },
    });
    if (!ownSession) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
  }

  const page = Math.max(1, Number.parseInt(pageRaw || "1", 10) || 1);
  let pageSize = Number.parseInt(pageSizeRaw || String(DEFAULT_PAGE_SIZE), 10) || DEFAULT_PAGE_SIZE;
  pageSize = Math.min(Math.max(1, pageSize), MAX_PAGE_SIZE);

  /** All sessions for this class (any instructor). Listing only `createdById` hid colleagues' / principal-recorded rows. */
  const where: Prisma.AttendanceSessionWhereInput = {
    subjectId,
    batchId,
  };

  const [total, sessions, allRecordsForSummary] = await Promise.all([
    db.attendanceSession.count({ where }),
    db.attendanceSession.findMany({
      where,
      include: {
        subject: true,
        records: {
          select: {
            studentId: true,
            status: true,
            student: { select: { firstName: true, lastName: true } },
          },
        },
        teacherAttendance: true,
      },
      // Most recently saved first so a session just recorded (e.g. today’s date) appears on page 1.
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
    db.attendanceRecord.findMany({
      where: { session: where },
      select: { status: true },
    }),
  ]);

  let recordCount = 0;
  let presentCount = 0;
  let absentCount = 0;
  for (const r of allRecordsForSummary) {
    recordCount += 1;
    if (r.status === "PRESENT" || r.status === "LATE") presentCount += 1;
    if (r.status === "ABSENT") absentCount += 1;
  }
  const pctPresent =
    recordCount > 0 ? Math.round((100 * presentCount) / recordCount) : 0;
  const pctAbsent =
    recordCount > 0 ? Math.round((100 * absentCount) / recordCount) : 0;

  return NextResponse.json({
    sessions,
    total,
    page,
    pageSize,
    summary: {
      recordCount,
      presentCount,
      absentCount,
      pctPresent,
      pctAbsent,
    },
  });
}
