import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { getServerAppUrl } from "@/lib/app-url";
import { sendEmail, buildEnrollmentOnboardingEmail, buildApplicationRejectedEmail } from "@/lib/email";
import { notifyStudentStatusChange } from "@/lib/student-status";
import {
  syncProgramApplicationsWithProfileEnrolled,
  syncStudentProfileWithApplicationEnrolled,
} from "@/lib/sync-enrollment-status";
import { hasPrincipalPortalAccess } from "@/lib/portal-access";
import { NextResponse } from "next/server";

export async function PUT(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!hasPrincipalPortalAccess(session)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const body = await req.json();
  const { action, batchId, reviewNotes } = body as { action: string; batchId?: string; reviewNotes?: string };

  const application = await db.programApplication.findUnique({
    where: { id },
    include: { applicant: true, program: true },
  });
  if (!application) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const appUrl = getServerAppUrl();

  if (action === "accept") {
    const prevProfile = await db.studentProfile.findUnique({
      where: { userId: application.applicantId },
      select: { status: true },
    });

    await db.programApplication.update({
      where: { id },
      data: { status: "ACCEPTED", reviewedById: session.user.id, reviewedAt: new Date(), reviewNotes },
    });

    await db.studentProfile.updateMany({
      where: { userId: application.applicantId },
      data: { status: "ACCEPTED" },
    });

    const prev = prevProfile?.status ?? "APPLIED";
    if (prev !== "ACCEPTED") {
      await notifyStudentStatusChange(application.applicantId, prev, "ACCEPTED");
    }
  } else if (action === "reject") {
    await db.programApplication.update({
      where: { id },
      data: { status: "REJECTED", reviewedById: session.user.id, reviewedAt: new Date(), reviewNotes },
    });

    const portalUrl = `${appUrl.replace(/\/$/, "")}/student`;
    const rejectedPayload = buildApplicationRejectedEmail({
      firstName: application.applicant.firstName,
      programName: application.program.name,
      reviewNotes: typeof reviewNotes === "string" ? reviewNotes : null,
      portalUrl,
    });
    await sendEmail({
      to: application.applicant.email,
      subject: rejectedPayload.subject,
      html: rejectedPayload.html,
      text: rejectedPayload.text,
    });

    await db.notification.create({
      data: {
        userId: application.applicantId,
        type: "GENERAL",
        title: "Application not approved",
        message: `Your application to ${application.program.name} was not approved for this intake. Check your email for details.`,
        link: "/student/apply",
      },
    });
  } else if (action === "enroll") {
    if (!batchId) return NextResponse.json({ error: "Batch is required for enrollment" }, { status: 400 });

    const profile = await db.studentProfile.findUnique({
      where: { userId: application.applicantId },
    });

    /** Admin pre-added student: program/batch/enrollment already set; only align application + skip duplicate placement emails. */
    const placementAlreadyRecorded =
      profile?.programId === application.programId &&
      profile?.batchId === batchId &&
      Boolean(profile?.enrollmentNo) &&
      profile.status === "ACCEPTED" &&
      application.status === "ACCEPTED";

    if (placementAlreadyRecorded) {
      await db.programApplication.update({
        where: { id },
        data: {
          status: "ENROLLED",
          batchId,
          reviewedById: session.user.id,
          reviewedAt: new Date(),
        },
      });
      await syncStudentProfileWithApplicationEnrolled(application.applicantId, application.programId);
      return NextResponse.json({ success: true, skippedPlacementEmails: true });
    }

    const enrollmentNo = `STU-${Date.now().toString(36).toUpperCase()}`;

    await db.programApplication.update({
      where: { id },
      data: { status: "ENROLLED", reviewedById: session.user.id, reviewedAt: new Date() },
    });

    /** Align profile with application ENROLLED (same lifecycle as ProgramApplication). */
    await db.studentProfile.upsert({
      where: { userId: application.applicantId },
      update: { programId: application.programId, batchId, status: "ENROLLED", enrollmentNo, enrollmentDate: new Date() },
      create: { userId: application.applicantId, programId: application.programId, batchId, status: "ENROLLED", enrollmentNo, enrollmentDate: new Date() },
    });

    await syncProgramApplicationsWithProfileEnrolled(application.applicantId, application.programId);

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
      data: {
        userId: application.applicantId,
        type: "ENROLLMENT_CONFIRMED",
        title: "Placement confirmed — complete onboarding",
        message: `Your place in ${application.program.name} is confirmed (enrollment #${enrollmentNo}). Open Onboarding in the student portal to finish the checklist. Full course access unlocks after your principal reviews and approves.`,
        link: `${appUrl.replace(/\/$/, "")}/student/onboarding`,
      },
    });
  }

  return NextResponse.json({ success: true });
}
