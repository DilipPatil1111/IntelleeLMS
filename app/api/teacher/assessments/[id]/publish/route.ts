import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { syncAssessmentAssignedStudents } from "@/lib/assessment-assigned-students";
import { getServerAppUrl } from "@/lib/app-url";
import { NextResponse } from "next/server";

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  const { selectedStudentIds = [], sendEmail = false } = body as {
    selectedStudentIds?: string[];
    sendEmail?: boolean;
  };

  const assessment = await db.assessment.findUnique({
    where: { id },
    include: { batch: true },
  });

  if (!assessment) return NextResponse.json({ error: "Not found" }, { status: 404 });

  if (!selectedStudentIds.length) {
    return NextResponse.json(
      { error: "Select at least one student to assign this assessment." },
      { status: 400 }
    );
  }

  await syncAssessmentAssignedStudents(id, selectedStudentIds);

  await db.assessment.update({
    where: { id },
    data: { status: "PUBLISHED" },
  });

  if (sendEmail && selectedStudentIds.length > 0) {
    const students = await db.user.findMany({
      where: { id: { in: selectedStudentIds } },
      select: { id: true, email: true, firstName: true },
    });

    const appUrl = getServerAppUrl();
    const link = `${appUrl}/assess/${assessment.linkToken}`;

    const emailRecords = students.map((s) => ({
      assessmentId: assessment.id,
      emailType: "ASSESSMENT_INVITE",
      recipientEmail: s.email,
      subject: `New Assessment: ${assessment.title}`,
      body: `Hi ${s.firstName}, you have a new assessment "${assessment.title}". Click here to start: ${link}`,
      scheduledAt: new Date(),
    }));

    await db.scheduledEmail.createMany({ data: emailRecords });
  }

  // Create notification for selected students
  if (selectedStudentIds.length > 0) {
    const appUrl = getServerAppUrl();
    const notifications = selectedStudentIds.map((studentId) => ({
      userId: studentId,
      type: "ASSESSMENT_INVITE" as const,
      title: `New Assessment: ${assessment.title}`,
      message: `You have been assigned a new ${assessment.type.toLowerCase()}. Click to start.`,
      link: `${appUrl}/assess/${assessment.linkToken}`,
    }));
    await db.notification.createMany({ data: notifications });
  }

  return NextResponse.json({ success: true });
}
