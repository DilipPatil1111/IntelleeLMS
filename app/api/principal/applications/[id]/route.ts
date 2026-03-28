import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { getServerAppUrl } from "@/lib/app-url";
import { sendEmail, buildEnrollmentOnboardingEmail } from "@/lib/email";
import { NextResponse } from "next/server";

export async function PUT(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  const { action, batchId, reviewNotes } = body as { action: string; batchId?: string; reviewNotes?: string };

  const application = await db.programApplication.findUnique({
    where: { id },
    include: { applicant: true, program: true },
  });
  if (!application) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const appUrl = getServerAppUrl();

  if (action === "accept") {
    await db.programApplication.update({
      where: { id },
      data: { status: "ACCEPTED", reviewedById: session.user.id, reviewedAt: new Date(), reviewNotes },
    });

    await db.studentProfile.updateMany({
      where: { userId: application.applicantId },
      data: { status: "ACCEPTED" },
    });

    // Acceptance email
    const template = await db.emailTemplate.findUnique({ where: { name: "application_accepted" } });
    const subject = template?.subject || `Congratulations! Application Accepted - ${application.program.name}`;
    const emailBody = template?.body
      ? template.body.replace("{{firstName}}", application.applicant.firstName).replace("{{programName}}", application.program.name)
      : `Dear ${application.applicant.firstName},\n\nCongratulations! Your application to ${application.program.name} has been accepted.\n\nYou will receive enrollment details shortly.\n\nBest regards,\nIntellee College`;

    await db.scheduledEmail.create({
      data: { emailType: "APPLICATION_ACCEPTED", recipientEmail: application.applicant.email, subject, body: emailBody, scheduledAt: new Date() },
    });

    await db.notification.create({
      data: { userId: application.applicantId, type: "APPLICATION_ACCEPTED", title: "Application Accepted!", message: `Your application to ${application.program.name} has been accepted.` },
    });
  } else if (action === "reject") {
    await db.programApplication.update({
      where: { id },
      data: { status: "REJECTED", reviewedById: session.user.id, reviewedAt: new Date(), reviewNotes },
    });
  } else if (action === "enroll") {
    if (!batchId) return NextResponse.json({ error: "Batch is required for enrollment" }, { status: 400 });

    const enrollmentNo = `STU-${Date.now().toString(36).toUpperCase()}`;

    await db.programApplication.update({
      where: { id },
      data: { status: "ENROLLED", reviewedById: session.user.id, reviewedAt: new Date() },
    });

    await db.studentProfile.upsert({
      where: { userId: application.applicantId },
      update: { programId: application.programId, batchId, status: "ENROLLED", enrollmentNo, enrollmentDate: new Date() },
      create: { userId: application.applicantId, programId: application.programId, batchId, status: "ENROLLED", enrollmentNo, enrollmentDate: new Date() },
    });

    await db.studentOnboarding.upsert({
      where: { userId: application.applicantId },
      create: { userId: application.applicantId },
      update: {},
    });

    const onboardingUrl = `${appUrl.replace(/\/$/, "")}/student/onboarding`;
    const studentUrl = `${appUrl.replace(/\/$/, "")}/student`;

    const enrollPayload = buildEnrollmentOnboardingEmail({
      firstName: application.applicant.firstName,
      programName: application.program.name,
      enrollmentNo,
      studentUrl,
      onboardingUrl,
    });
    await sendEmail({
      to: application.applicant.email,
      subject: enrollPayload.subject,
      html: enrollPayload.html,
      text: enrollPayload.text,
    });

    const template = await db.emailTemplate.findUnique({ where: { name: "enrollment_confirmed" } });
    const subject = template?.subject || enrollPayload.subject;
    const emailBody = template?.body
      ? template.body.replace("{{firstName}}", application.applicant.firstName).replace("{{programName}}", application.program.name).replace("{{profileLink}}", `${appUrl}/student/profile`)
      : enrollPayload.text;

    await db.scheduledEmail.create({
      data: { emailType: "ENROLLMENT_CONFIRMED", recipientEmail: application.applicant.email, subject, body: emailBody, scheduledAt: new Date() },
    });

    await db.notification.create({
      data: { userId: application.applicantId, type: "ENROLLMENT_CONFIRMED", title: "Enrollment Confirmed!", message: `You are now enrolled in ${application.program.name}. Enrollment #${enrollmentNo}`, link: `${appUrl}/student` },
    });
  }

  return NextResponse.json({ success: true });
}
