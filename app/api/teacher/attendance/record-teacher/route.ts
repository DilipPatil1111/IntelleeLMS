import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { NextResponse } from "next/server";

const STATUSES = ["PRESENT", "ABSENT", "LATE", "EXCUSED"] as const;

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  const { attendanceSessionId, status } = body as { attendanceSessionId?: string; status?: string };

  if (!attendanceSessionId || !status || !STATUSES.includes(status as (typeof STATUSES)[number])) {
    return NextResponse.json({ error: "Session and valid status required" }, { status: 400 });
  }

  const attSession = await db.attendanceSession.findUnique({
    where: { id: attendanceSessionId },
  });
  if (!attSession || attSession.createdById !== session.user.id) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  await db.teacherAttendance.upsert({
    where: { attendanceSessionId },
    create: {
      attendanceSessionId,
      teacherUserId: session.user.id,
      status: status as "PRESENT" | "ABSENT" | "LATE" | "EXCUSED",
    },
    update: { status: status as "PRESENT" | "ABSENT" | "LATE" | "EXCUSED" },
  });

  await db.notification.updateMany({
    where: {
      userId: session.user.id,
      type: "TEACHER_SELF_ATTENDANCE_REQUIRED",
      link: { contains: attendanceSessionId },
    },
    data: { isRead: true },
  });

  return NextResponse.json({ success: true });
}
