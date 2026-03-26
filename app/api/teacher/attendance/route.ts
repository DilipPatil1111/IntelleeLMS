import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { NextResponse } from "next/server";

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  const { subjectId, batchId, sessionDate, startTime, endTime, attendance, overrideHoliday } = body;

  const attendanceSession = await db.attendanceSession.create({
    data: {
      subjectId,
      batchId,
      sessionDate: new Date(sessionDate),
      startTime: startTime || null,
      endTime: endTime || null,
      overrideHoliday: overrideHoliday || false,
      createdById: session.user.id,
      records: {
        create: Object.entries(attendance as Record<string, string>).map(([studentId, status]) => ({
          studentId,
          status: status as "PRESENT" | "ABSENT" | "LATE" | "EXCUSED",
        })),
      },
    },
  });

  return NextResponse.json({ id: attendanceSession.id });
}
