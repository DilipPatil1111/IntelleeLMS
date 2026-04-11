import { NextRequest, NextResponse } from "next/server";
import { requirePrincipalPortal } from "@/lib/api-auth";
import { db } from "@/lib/db";
import { sendEmailWithSignature } from "@/lib/email-signature";

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const gate = await requirePrincipalPortal();
  if (!gate.ok) return gate.response;
  const session = gate.session;
  const { id } = await params;

  const body = await req.json();
  const { action, staffMessage } = body as {
    action: "EXCUSED" | "DENIED" | "KEPT_ABSENT";
    staffMessage?: string;
  };

  if (!["EXCUSED", "DENIED", "KEPT_ABSENT"].includes(action)) {
    return NextResponse.json({ error: "Invalid action" }, { status: 400 });
  }

  const request = await db.attendanceExcuseRequest.findUnique({
    where: { id },
    include: {
      attendanceRecord: {
        include: {
          session: {
            include: {
              subject: { select: { name: true } },
            },
          },
        },
      },
      student: { select: { id: true, firstName: true, lastName: true, email: true } },
    },
  });
  if (!request) {
    return NextResponse.json({ error: "Request not found" }, { status: 404 });
  }
  if (request.status !== "PENDING") {
    return NextResponse.json({ error: "Request already resolved" }, { status: 400 });
  }

  if (action === "EXCUSED") {
    await db.attendanceRecord.update({
      where: { id: request.attendanceRecordId },
      data: { status: "EXCUSED" },
    });
  }

  const updated = await db.attendanceExcuseRequest.update({
    where: { id },
    data: {
      status: action,
      staffMessage: staffMessage?.trim() || null,
      resolvedById: session.user.id,
      resolvedAt: new Date(),
    },
  });

  const resolver = await db.user.findUnique({ where: { id: session.user.id }, select: { firstName: true, lastName: true } });
  const resolverName = resolver ? `${resolver.firstName} ${resolver.lastName}` : "Administrator";
  const subjectName = request.attendanceRecord.session?.subject?.name ?? "a subject";
  const sessionDate = request.attendanceRecord.session?.sessionDate
    ? new Date(request.attendanceRecord.session.sessionDate).toLocaleDateString()
    : "unknown date";

  const actionLabel = action === "EXCUSED" ? "excused" : action === "DENIED" ? "denied" : "kept as absent";
  const studentName = `${request.student.firstName} ${request.student.lastName}`;

  // Notify + email student
  await db.notification.create({
    data: {
      userId: request.studentUserId,
      type: "ATTENDANCE_EXCUSE_RESOLVED",
      title: `Attendance Excuse ${action === "EXCUSED" ? "Approved" : action === "DENIED" ? "Denied" : "Kept Absent"}`,
      message: `${resolverName} has ${actionLabel} your attendance excuse request for ${subjectName} on ${sessionDate}.${staffMessage ? ` Note: ${staffMessage}` : ""}`,
    },
  });

  await sendEmailWithSignature({
    to: request.student.email,
    subject: `Attendance Excuse Request — ${action === "EXCUSED" ? "Approved" : action === "DENIED" ? "Denied" : "Kept Absent"}`,
    html: `<p>Dear ${studentName},</p>
<p>Your attendance excuse request for <strong>${subjectName}</strong> on <strong>${sessionDate}</strong> has been <strong>${actionLabel}</strong> by ${resolverName}.</p>
${staffMessage ? `<p><strong>Comment:</strong> ${staffMessage}</p>` : ""}
<p>If you have questions, please contact your teacher or administrator.</p>`,
    senderUserId: session.user.id,
  }).catch(() => {});

  // Notify + email the original session teacher if different from the resolver
  const teacherId = request.attendanceRecord.session?.createdById;
  if (teacherId && teacherId !== session.user.id) {
    const teacher = await db.user.findUnique({
      where: { id: teacherId },
      select: { id: true, firstName: true, lastName: true, email: true },
    });
    if (teacher) {
      await db.notification.create({
        data: {
          userId: teacher.id,
          type: "ATTENDANCE_EXCUSE_RESOLVED",
          title: `Attendance Excuse ${action === "EXCUSED" ? "Approved" : action === "DENIED" ? "Denied" : "Kept Absent"}`,
          message: `${resolverName} ${actionLabel} the attendance excuse for ${studentName} — ${subjectName} on ${sessionDate}.`,
        },
      });

      await sendEmailWithSignature({
        to: teacher.email,
        subject: `Attendance Excuse Resolved — ${studentName}`,
        html: `<p>Dear ${teacher.firstName},</p>
<p>${resolverName} has ${actionLabel} the attendance excuse request from <strong>${studentName}</strong> for <strong>${subjectName}</strong> on <strong>${sessionDate}</strong>.</p>
${staffMessage ? `<p><strong>Comment:</strong> ${staffMessage}</p>` : ""}`,
        senderUserId: session.user.id,
      }).catch(() => {});
    }
  }

  return NextResponse.json({ request: updated });
}
