import { db } from "@/lib/db";
import { sendEmailWithSignature } from "@/lib/email-signature";
import { timingSafeEqual } from "crypto";
import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (!secret) {
    return NextResponse.json({ error: "CRON_SECRET not configured" }, { status: 503 });
  }
  const authHeader = req.headers.get("authorization") ?? "";
  const expected = `Bearer ${secret}`;
  if (
    expected.length !== authHeader.length ||
    !timingSafeEqual(Buffer.from(expected), Buffer.from(authHeader))
  ) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const now = new Date();
  const pendingEmails = await db.scheduledEmail.findMany({
    where: { isSent: false, scheduledAt: { lte: now } },
    take: 50,
  });

  let sent = 0;
  for (const email of pendingEmails) {
    try {
      const result = await sendEmailWithSignature({
        to: email.recipientEmail,
        subject: email.subject,
        text: email.body || "",
        senderUserId: null,
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
