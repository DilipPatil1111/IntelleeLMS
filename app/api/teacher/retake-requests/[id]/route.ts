import { NextRequest, NextResponse } from "next/server";
import { requireTeacherPortal } from "@/lib/api-auth";
import { isTeacherOwnershipRestricted } from "@/lib/portal-access";
import { db } from "@/lib/db";

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const gate = await requireTeacherPortal();
  if (!gate.ok) return gate.response;
  const session = gate.session;
  const { id } = await params;

  const body = await req.json();
  const { action, staffMessage } = body as {
    action: "APPROVED_RETAKE" | "EXCUSED" | "DENIED";
    staffMessage?: string;
  };

  if (!["APPROVED_RETAKE", "EXCUSED", "DENIED"].includes(action)) {
    return NextResponse.json({ error: "Invalid action" }, { status: 400 });
  }

  const request = await db.assessmentRetakeRequest.findUnique({
    where: { id },
    include: {
      assessment: { select: { id: true, title: true, createdById: true, subject: { select: { name: true } } } },
    },
  });
  if (!request) {
    return NextResponse.json({ error: "Request not found" }, { status: 404 });
  }

  // If restricted teacher, ensure they own the assessment
  if (isTeacherOwnershipRestricted(session) && request.assessment.createdById !== session.user.id) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  if (request.status !== "PENDING") {
    return NextResponse.json({ error: "Request already resolved" }, { status: 400 });
  }

  // If approving retake, delete the student's existing attempt + answers
  if (action === "APPROVED_RETAKE") {
    await db.answer.deleteMany({
      where: { attempt: { assessmentId: request.assessmentId, studentId: request.studentUserId } },
    });
    await db.attempt.deleteMany({
      where: { assessmentId: request.assessmentId, studentId: request.studentUserId },
    });
  }

  const updated = await db.assessmentRetakeRequest.update({
    where: { id },
    data: {
      status: action,
      staffMessage: staffMessage?.trim() || null,
      resolvedById: session.user.id,
      resolvedAt: new Date(),
    },
  });

  // Notify the student
  const resolver = await db.user.findUnique({ where: { id: session.user.id }, select: { firstName: true, lastName: true } });
  const resolverName = resolver ? `${resolver.firstName} ${resolver.lastName}` : "Your teacher";

  let notifMessage = "";
  if (action === "APPROVED_RETAKE") {
    notifMessage = `${resolverName} has approved your retake request for "${request.assessment.title}". You can now retake the assessment.`;
  } else if (action === "EXCUSED") {
    notifMessage = `${resolverName} has excused your result for "${request.assessment.title}" for certificate purposes.${staffMessage ? ` Note: ${staffMessage}` : ""}`;
  } else {
    notifMessage = `${resolverName} has denied your retake request for "${request.assessment.title}".${staffMessage ? ` Note: ${staffMessage}` : ""}`;
  }

  // Notify student
  await db.notification.create({
    data: {
      userId: request.studentUserId,
      type: "RETAKE_REQUEST_RESOLVED",
      title: action === "APPROVED_RETAKE" ? "Retake Approved" : action === "EXCUSED" ? "Result Excused" : "Retake Denied",
      message: notifMessage,
    },
  });

  // Also notify all principals about the resolution
  const principals = await db.user.findMany({
    where: { role: "PRINCIPAL", isActive: true, id: { not: session.user.id } },
    select: { id: true },
  });
  const student = await db.user.findUnique({ where: { id: request.studentUserId }, select: { firstName: true, lastName: true } });
  const studentName = student ? `${student.firstName} ${student.lastName}` : "Student";

  if (principals.length > 0) {
    await db.notification.createMany({
      data: principals.map((p) => ({
        userId: p.id,
        type: "RETAKE_REQUEST_RESOLVED" as const,
        title: `Retake Request ${action === "APPROVED_RETAKE" ? "Approved" : action === "EXCUSED" ? "Excused" : "Denied"}`,
        message: `${resolverName} ${action === "APPROVED_RETAKE" ? "approved a retake" : action === "EXCUSED" ? "excused the result" : "denied the retake"} for ${studentName} on "${request.assessment.title}".${staffMessage ? ` Comment: ${staffMessage}` : ""}`,
      })),
    });
  }

  return NextResponse.json({ request: updated });
}
