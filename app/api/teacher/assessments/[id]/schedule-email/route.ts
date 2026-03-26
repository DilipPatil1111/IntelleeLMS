import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { NextResponse } from "next/server";

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  const { scheduledAt, emailType = "ASSESSMENT_INVITE" } = body;

  const assessment = await db.assessment.findUnique({
    where: { id },
    include: { batch: { include: { students: { include: { user: true } } } } },
  });

  if (!assessment) return NextResponse.json({ error: "Assessment not found" }, { status: 404 });

  const appUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
  const link = `${appUrl}/student/assessments/${assessment.id}/take`;

  const emails = assessment.batch.students.map((sp) => ({
    assessmentId: assessment.id,
    emailType,
    recipientEmail: sp.user.email,
    subject: emailType === "ASSESSMENT_INVITE"
      ? `New Assessment: ${assessment.title}`
      : `Results Available: ${assessment.title}`,
    body: emailType === "ASSESSMENT_INVITE"
      ? `You have a new assessment "${assessment.title}". Click here to start: ${link}`
      : `Your results for "${assessment.title}" are now available. Check your dashboard.`,
    scheduledAt: new Date(scheduledAt),
  }));

  await db.scheduledEmail.createMany({ data: emails });

  return NextResponse.json({ success: true, count: emails.length });
}
