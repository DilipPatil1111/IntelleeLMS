import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { NextResponse } from "next/server";

export async function GET() {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const programs = await db.program.findMany({
    where: { isActive: true },
    select: { id: true, name: true, code: true, description: true, durationYears: true },
    orderBy: { name: "asc" },
  });

  const applications = await db.programApplication.findMany({
    where: { applicantId: session.user.id },
    include: { program: { select: { name: true, code: true } } },
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json({ programs, applications });
}

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  const { programId, personalStatement, batchId } = body as {
    programId?: string;
    personalStatement?: string;
    batchId?: string;
  };

  if (!programId) return NextResponse.json({ error: "Program is required" }, { status: 400 });

  const existing = await db.programApplication.findFirst({
    where: { applicantId: session.user.id, programId, status: { in: ["PENDING", "UNDER_REVIEW", "ACCEPTED"] } },
  });
  if (existing) return NextResponse.json({ error: "You already have an active application for this program" }, { status: 400 });

  let validBatchId: string | null = null;
  if (batchId && typeof batchId === "string") {
    const b = await db.batch.findFirst({
      where: { id: batchId, programId, isActive: true },
    });
    if (b) validBatchId = b.id;
  }

  const application = await db.programApplication.create({
    data: {
      applicantId: session.user.id,
      programId,
      batchId: validBatchId,
      personalStatement: personalStatement || null,
    },
  });

  await db.studentProfile.updateMany({
    where: { userId: session.user.id },
    data: { programId, batchId: validBatchId, status: "APPLIED" },
  });

  // Create auto-reply notification
  await db.notification.create({
    data: {
      userId: session.user.id,
      type: "APPLICATION_RECEIVED",
      title: "Application Received",
      message: "Your program application has been received. We will review it and get back to you soon.",
    },
  });

  // Queue auto-reply email
  const user = await db.user.findUnique({ where: { id: session.user.id }, select: { email: true, firstName: true } });
  const program = await db.program.findUnique({ where: { id: programId }, select: { name: true } });

  const template = await db.emailTemplate.findUnique({ where: { name: "application_received" } });
  const subject = template?.subject || `Application Received - ${program?.name}`;
  const emailBody = template?.body
    ? template.body.replace("{{firstName}}", user?.firstName || "Student").replace("{{programName}}", program?.name || "")
    : `Dear ${user?.firstName},\n\nThank you for applying to ${program?.name}. Your application has been received and is under review.\n\nWe will notify you once a decision has been made.\n\nBest regards,\nIntellee College`;

  if (user?.email) {
    await db.scheduledEmail.create({
      data: {
        emailType: "APPLICATION_AUTO_REPLY",
        recipientEmail: user.email,
        subject,
        body: emailBody,
        scheduledAt: new Date(),
      },
    });
  }

  return NextResponse.json({ id: application.id });
}
