import { requirePrincipalPortal } from "@/lib/api-auth";
import { db } from "@/lib/db";
import { getTranscriptById } from "@/lib/transcript";
import { sendEmail } from "@/lib/email";
import { buildEmailHeader, buildEmailSignatureHtml } from "@/lib/email-signature";
import { NextResponse } from "next/server";

export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const gate = await requirePrincipalPortal();
  if (!gate.ok) return gate.response;
  const { id } = await params;

  const transcript = await getTranscriptById(id);
  if (!transcript) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (transcript.status === "PUBLISHED") {
    return NextResponse.json({ error: "Already published" }, { status: 400 });
  }

  const updated = await db.transcript.update({
    where: { id },
    data: { status: "PUBLISHED", publishedAt: new Date() },
  });

  // Send email notification to student
  try {
    const [headerHtml, signatureHtml] = await Promise.all([buildEmailHeader(), buildEmailSignatureHtml(gate.session.user.id)]);
    const studentName = `${transcript.student.firstName} ${transcript.student.lastName}`;
    const programName = transcript.program.name;

    await sendEmail({
      to: transcript.student.email,
      subject: `Your Final Transcript is Available — ${programName}`,
      html: `
        <p>Dear ${studentName},</p>
        <p>Your <strong>Final Transcript</strong> for <strong>${programName}</strong> is now available.</p>
        <p>Please log in to your student portal and navigate to <strong>Reports &gt; Final Transcript</strong> to view and download your transcript.</p>
        <p>If you have any questions, please contact your program coordinator.</p>
      `,
      headerHtml,
      signatureHtml,
    });
  } catch {
    // Email failure must not block publish
  }

  return NextResponse.json({ transcript: updated });
}
