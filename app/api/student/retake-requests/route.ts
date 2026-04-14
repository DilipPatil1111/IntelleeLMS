import { NextRequest, NextResponse } from "next/server";
import { requireStudentPortal } from "@/lib/api-auth";
import { db } from "@/lib/db";

export async function GET() {
  const gate = await requireStudentPortal();
  if (!gate.ok) return gate.response;

  const requests = await db.assessmentRetakeRequest.findMany({
    where: { studentUserId: gate.session.user.id },
    include: {
      assessment: { select: { id: true, title: true, type: true, subject: { select: { name: true } } } },
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
  const { assessmentId, message } = body as { assessmentId: string; message?: string };

  if (!assessmentId) {
    return NextResponse.json({ error: "assessmentId is required" }, { status: 400 });
  }

  // Verify the student has a below-passing attempt on this assessment
  const assessment = await db.assessment.findUnique({
    where: { id: assessmentId },
    include: { subject: { select: { name: true, programId: true } } },
  });
  if (!assessment) {
    return NextResponse.json({ error: "Assessment not found" }, { status: 404 });
  }

  const attempt = await db.attempt.findFirst({
    where: {
      assessmentId,
      studentId: userId,
      status: { in: ["SUBMITTED", "GRADED"] },
    },
  });
  if (!attempt) {
    return NextResponse.json({ error: "No submitted attempt found for this assessment" }, { status: 400 });
  }

  const totalMarks = assessment.totalMarks ?? 0;
  const passingMarks = assessment.passingMarks ?? Math.round(totalMarks * 0.4);
  if ((attempt.totalScore ?? 0) >= passingMarks) {
    return NextResponse.json({ error: "You passed this assessment — no retake needed" }, { status: 400 });
  }

  // Check if a request already exists
  const existing = await db.assessmentRetakeRequest.findUnique({
    where: { assessmentId_studentUserId: { assessmentId, studentUserId: userId } },
  });
  if (existing) {
    return NextResponse.json({ error: "A retake request already exists for this assessment", existingStatus: existing.status }, { status: 409 });
  }

  const request = await db.assessmentRetakeRequest.create({
    data: {
      assessmentId,
      studentUserId: userId,
      studentMessage: message?.trim() || null,
    },
  });

  // Notify the assessment creator (teacher) and all principals
  const student = await db.user.findUnique({ where: { id: userId }, select: { firstName: true, lastName: true } });
  const studentName = student ? `${student.firstName} ${student.lastName}` : "A student";
  const notifTitle = "Retake Request";
  const notifMessage = `${studentName} has requested a retake for "${assessment.title}" (${assessment.subject?.name ?? ""}).`;

  const principals = await db.user.findMany({
    where: { role: "PRINCIPAL", isActive: true },
    select: { id: true },
  });
  const recipientIds = [...new Set([assessment.createdById, ...principals.map((p) => p.id)])];

  await db.notification.createMany({
    data: recipientIds.map((uid) => ({
      userId: uid,
      type: "RETAKE_REQUEST" as const,
      title: notifTitle,
      message: notifMessage,
      link: null,
    })),
  });

  return NextResponse.json({ request }, { status: 201 });
}
