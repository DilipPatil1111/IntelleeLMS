import { escapeHtml } from "@/lib/email";
import { sendEmailWithSignature } from "@/lib/email-signature";
import { getServerAppUrl } from "@/lib/app-url";

export async function sendFeedbackReplyEmail(params: {
  to: string;
  recipientFirstName: string;
  reply: string;
}): Promise<void> {
  const { to, recipientFirstName, reply } = params;
  const base = getServerAppUrl().replace(/\/$/, "");
  const notifUrl = `${base}/student/notifications`;
  const feedbackUrl = `${base}/student/feedback`;
  const subj = "Update on your feedback — Intellee College";
  const html = `
      <div style="font-family: system-ui, sans-serif; max-width: 600px; margin: 0 auto; color: #111827;">
        <h2 style="color: #4f46e5;">Intellee College</h2>
        <p>Hello ${escapeHtml(recipientFirstName)},</p>
        <p>The administration has responded to feedback you submitted:</p>
        <div style="background: #f3f4f6; border-radius: 8px; padding: 16px; margin: 16px 0; white-space: pre-wrap;">${escapeHtml(reply)}</div>
        <p style="font-size: 14px; color: #6b7280;">You can review your feedback history in the portal.</p>
        <p><a href="${escapeHtml(feedbackUrl)}" style="color: #4f46e5;">Open feedback</a> · <a href="${escapeHtml(notifUrl)}" style="color: #4f46e5;">Notifications</a></p>
      </div>
    `;
  const text = `Hello ${recipientFirstName},\n\nAdministration response:\n\n${reply}\n\nFeedback: ${feedbackUrl}\n`;
  await sendEmailWithSignature({ to, subject: subj, html, text, senderUserId: null });
}
