import { db } from "@/lib/db";
import { sendEmail } from "@/lib/email";
import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (secret) {
    const authHeader = req.headers.get("authorization");
    if (authHeader !== `Bearer ${secret}`) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
  }

  const now = new Date();
  const pendingEmails = await db.scheduledEmail.findMany({
    where: { isSent: false, scheduledAt: { lte: now } },
    take: 50,
  });

  let sent = 0;
  for (const email of pendingEmails) {
    try {
      const result = await sendEmail({
        to: email.recipientEmail,
        subject: email.subject,
        text: email.body || "",
      });

      if (result.ok) {
        await db.scheduledEmail.update({
          where: { id: email.id },
          data: { isSent: true, sentAt: new Date() },
        });
        sent++;
      } else {
        console.error("[cron/send-emails] Failed to send to", email.recipientEmail, result.error);
      }
    } catch (err) {
      console.error("[cron/send-emails] Unexpected error for email", email.id, err);
    }
  }

  return NextResponse.json({ sent, total: pendingEmails.length });
}
