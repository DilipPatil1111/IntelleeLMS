import { sendEmail } from "@/lib/email";
import { getServerAppUrl } from "@/lib/app-url";
import { escapeHtml } from "@/lib/email";

function studentDashboardUrl(): string {
  const base = getServerAppUrl().replace(/\/$/, "");
  return `${base}/student`;
}

function notificationsUrl(): string {
  const base = getServerAppUrl().replace(/\/$/, "");
  return `${base}/student/notifications`;
}

/** Sends a transactional email when principal updates student enrollment status. */
export async function sendStudentStatusChangeEmail(params: {
  to: string;
  firstName: string;
  title: string;
  message: string;
}): Promise<void> {
  const { to, firstName, title, message } = params;
  const dash = studentDashboardUrl();
  const notif = notificationsUrl();
  const subj = `${title} — Intellee College`;
  const html = `
      <div style="font-family: system-ui, sans-serif; max-width: 600px; margin: 0 auto; color: #111827;">
        <div style="border-bottom: 3px solid #4f46e5; padding-bottom: 12px; margin-bottom: 20px;">
          <h1 style="margin: 0; font-size: 20px; color: #4f46e5;">Intellee College</h1>
          <p style="margin: 8px 0 0; font-size: 13px; color: #6b7280;">Enrollment update</p>
        </div>
        <p style="font-size: 16px;">Hello ${escapeHtml(firstName)},</p>
        <p style="font-size: 15px; line-height: 1.6;"><strong>${escapeHtml(title)}</strong></p>
        <p style="font-size: 15px; line-height: 1.65; color: #374151;">${escapeHtml(message)}</p>
        <p style="margin-top: 24px;">
          <a href="${escapeHtml(dash)}" style="background: #4f46e5; color: #fff; padding: 12px 22px; border-radius: 8px; text-decoration: none; display: inline-block; font-weight: 600;">Open dashboard</a>
        </p>
        <p style="font-size: 13px; color: #6b7280; margin-top: 20px;">
          <a href="${escapeHtml(notif)}" style="color: #4f46e5;">View notifications</a> in the portal for the full message.
        </p>
      </div>
    `;
  const text = `Hello ${firstName},\n\n${title}\n\n${message}\n\nDashboard: ${dash}\nNotifications: ${notif}\n`;
  await sendEmail({ to, subject: subj, html, text });
}
