import { requireTeacherPortal } from "@/lib/api-auth";
import { db } from "@/lib/db";
import { getTranscriptById } from "@/lib/transcript";
import { sendEmail } from "@/lib/email";
import { buildEmailHeader, buildEmailSignatureHtml } from "@/lib/email-signature";
import { NextResponse } from "next/server";

export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const gate = await requireTeacherPortal();
  if (!gate.ok) return gate.response;
  const { id } = await params;

  const transcript = await getTranscriptById(id);
  if (!transcript) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (transcript.createdById !== gate.session.user.id) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  if (transcript.status === "PUBLISHED") return NextResponse.json({ error: "Already published" }, { status: 400 });

  const updated = await db.transcript.update({
    where: { id },
    data: { status: "PUBLISHED", publishedAt: new Date() },
  });

  try {
    const [headerHtml, signatureHtml] = await Promise.all([buildEmailHeader(), buildEmailSignatureHtml(gate.session.user.id)]);
    const studentName = `${transcript.student.firstName} ${transcript.student.lastName}`;
    await sendEmail({
      to: transcript.student.email,
      subject: `Your Final Transcript is Available — ${transcript.program.name}`,
      html: `<p>Dear ${studentName},</p><p>Your <strong>Final Transcript</strong> for <strong>${transcript.program.name}</strong> is now available.</p><p>Please log in to your student portal and navigate to <strong>Reports &gt; Final Transcript</strong> to view and download your transcript.</p>`,
      headerHtml,
      signatureHtml,
    });
  } catch { /* email failure must not block */ }

  return NextResponse.json({ transcript: updated });
}
