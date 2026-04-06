import { NextResponse } from "next/server";
import { requireTeacherPortal } from "@/lib/api-auth";
import { db } from "@/lib/db";
import { sendEmail } from "@/lib/email";

export const runtime = "nodejs";

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const gate = await requireTeacherPortal();
  if (!gate.ok) return gate.response;

  const { id } = await params;
  const recording = await db.sessionRecording.findUnique({ where: { id } });
  if (!recording) return NextResponse.json({ error: "Not found" }, { status: 404 });

  await db.sessionRecording.delete({ where: { id } });

  const principals = await db.user.findMany({
    where: { role: "PRINCIPAL", isActive: true },
    select: { email: true, firstName: true },
  });

  const teacher = await db.user.findUnique({
    where: { id: gate.session.user.id },
    select: { firstName: true, lastName: true },
  });

  for (const p of principals) {
    void sendEmail({
      to: p.email,
      subject: "Session Recording Deleted by Teacher",
      html: `
        <p>Dear ${p.firstName},</p>
        <p>Teacher <strong>${teacher?.firstName ?? ""} ${teacher?.lastName ?? ""}</strong> has deleted the session recording:</p>
        <ul>
          <li><strong>Title:</strong> ${recording.title}</li>
          <li><strong>Date:</strong> ${recording.sessionDate.toLocaleDateString()}</li>
        </ul>
        <p>This is an automated notification.</p>
      `,
    }).catch(console.error);
  }

  return NextResponse.json({ success: true });
}
