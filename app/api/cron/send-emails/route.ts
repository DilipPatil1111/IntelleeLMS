import { db } from "@/lib/db";
import { NextResponse } from "next/server";

export async function GET() {
  const now = new Date();

  const pendingEmails = await db.scheduledEmail.findMany({
    where: { isSent: false, scheduledAt: { lte: now } },
    take: 50,
  });

  let sent = 0;
  for (const email of pendingEmails) {
    try {
      const apiKey = process.env.RESEND_API_KEY;
      if (apiKey) {
        const { Resend } = await import("resend");
        const resend = new Resend(apiKey);
        await resend.emails.send({
          from: "Intellee College <noreply@intellee.edu>",
          to: email.recipientEmail,
          subject: email.subject,
          text: email.body || "",
        });
      }
      await db.scheduledEmail.update({
        where: { id: email.id },
        data: { isSent: true, sentAt: new Date() },
      });
      sent++;
    } catch {
      // Will retry on next cron run
    }
  }

  return NextResponse.json({ sent, total: pendingEmails.length });
}
