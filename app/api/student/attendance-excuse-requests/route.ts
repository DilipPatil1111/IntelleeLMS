import { NextRequest, NextResponse } from "next/server";
import { requireStudentPortal } from "@/lib/api-auth";
import { db } from "@/lib/db";

export async function GET() {
  const gate = await requireStudentPortal();
  if (!gate.ok) return gate.response;

  const requests = await db.attendanceExcuseRequest.findMany({
    where: { studentUserId: gate.session.user.id },
    include: {
      attendanceRecord: {
        include: { session: { include: { subject: true } } },
      },
      resolvedBy: { select: { firstName: true, lastName: true } },
    },
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json({ requests });
}

export async function POST(req: NextRequest) {
  const gate = await requireStudentPortal();
  if (!gate.ok) return gate.response;
  const userId = gate.session.user.id;

  const body = await req.json();
  const { attendanceRecordId, message } = body as { attendanceRecordId: string; message?: string };

  if (!attendanceRecordId) {
    return NextResponse.json({ error: "attendanceRecordId is required" }, { status: 400 });
  }

  const record = await db.attendanceRecord.findUnique({
    where: { id: attendanceRecordId },
    include: { session: { include: { subject: true } } },
  });

  if (!record) {
    return NextResponse.json({ error: "Attendance record not found" }, { status: 404 });
  }
  if (record.studentId !== userId) {
    return NextResponse.json({ error: "This is not your attendance record" }, { status: 403 });
  }
  if (record.status !== "ABSENT") {
    return NextResponse.json({ error: "Only ABSENT records can be excused" }, { status: 400 });
  }

  const existing = await db.attendanceExcuseRequest.findUnique({
    where: { attendanceRecordId_studentUserId: { attendanceRecordId, studentUserId: userId } },
  });
  if (existing) {
    return NextResponse.json({ error: "An excuse request already exists for this record", existingStatus: existing.status }, { status: 409 });
  }

  const request = await db.attendanceExcuseRequest.create({
    data: {
      attendanceRecordId,
      studentUserId: userId,
      studentMessage: message?.trim() || null,
    },
  });

  // Notify the session creator and all principals
  const student = await db.user.findUnique({ where: { id: userId }, select: { firstName: true, lastName: true } });
  const studentName = student ? `${student.firstName} ${student.lastName}` : "A student";
  const subjectName = record.session?.subject?.name ?? "a subject";
  const sessionDate = record.session?.sessionDate
    ? new Date(record.session.sessionDate).toLocaleDateString()
    : "unknown date";

  const principals = await db.user.findMany({
    where: { role: "PRINCIPAL", isActive: true },
    select: { id: true },
  });
  const recipientIds = [...new Set([record.session?.createdById, ...principals.map((p) => p.id)].filter(Boolean))] as string[];

  if (recipientIds.length > 0) {
    await db.notification.createMany({
      data: recipientIds.map((uid) => ({
        userId: uid,
        type: "ATTENDANCE_EXCUSE_REQUEST" as const,
        title: "Attendance Excuse Request",
        message: `${studentName} has requested to excuse absence for ${subjectName} on ${sessionDate}.`,
      })),
    });
  }

  return NextResponse.json({ request }, { status: 201 });
}
