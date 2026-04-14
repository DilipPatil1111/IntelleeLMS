import { requirePrincipalPortal } from "@/lib/api-auth";
import { db } from "@/lib/db";
import type { Prisma } from "@/app/generated/prisma/client";
import { slotDurationMinutes } from "@/lib/program-calendar-hours";
import { NextResponse } from "next/server";

function teacherNameFilter(teacherName: string): Prisma.UserWhereInput {
  const q = teacherName.trim();
  if (!q) return {};
  const parts = q.split(/\s+/).filter(Boolean);
  if (parts.length >= 2) {
    return {
      OR: [
        {
          AND: [
            { firstName: { contains: parts[0], mode: "insensitive" } },
            { lastName: { contains: parts[parts.length - 1], mode: "insensitive" } },
          ],
        },
        { firstName: { contains: q, mode: "insensitive" } },
        { lastName: { contains: q, mode: "insensitive" } },
      ],
    };
  }
  return {
    OR: [
      { firstName: { contains: q, mode: "insensitive" } },
      { lastName: { contains: q, mode: "insensitive" } },
    ],
  };
}

export async function GET(req: Request) {
  const gate = await requirePrincipalPortal();
  if (!gate.ok) return gate.response;
  const session = gate.session;

  const { searchParams } = new URL(req.url);
  const programId = searchParams.get("programId");
  const batchId = searchParams.get("batchId");
  const teacherUserId = searchParams.get("teacherUserId")?.trim() ?? "";
  const teacherName = searchParams.get("teacherName")?.trim() ?? "";

  const sessionWhere: Prisma.AttendanceSessionWhereInput = {};
  if (batchId) sessionWhere.batchId = batchId;
  if (programId) sessionWhere.batch = { programId };

  const and: Prisma.TeacherAttendanceWhereInput[] = [];
  if (Object.keys(sessionWhere).length) and.push({ session: sessionWhere });
  if (teacherUserId) {
    and.push({ teacherUserId });
  } else if (teacherName) {
    const tw = teacherNameFilter(teacherName);
    if (Object.keys(tw).length) and.push({ teacher: tw });
  }

  const where: Prisma.TeacherAttendanceWhereInput = and.length ? { AND: and } : {};

  const rows = await db.teacherAttendance.findMany({
    where,
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
    take: 5000,
  });

  let totalPresentHours = 0;
  for (const row of rows) {
    if (row.status !== "PRESENT" && row.status !== "LATE") continue;
    const mins = slotDurationMinutes(row.session.startTime, row.session.endTime);
    if (mins > 0) totalPresentHours += mins / 60;
  }
  totalPresentHours = Math.round(totalPresentHours * 10) / 10;

  return NextResponse.json({ records: rows, totalPresentHours });
}
