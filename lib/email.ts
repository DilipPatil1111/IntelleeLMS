import { Resend } from "resend";

let resend: Resend | null = null;

function getResend() {
  if (!resend && process.env.RESEND_API_KEY) {
    resend = new Resend(process.env.RESEND_API_KEY);
  }
  return resend;
}

interface SendEmailParams {
  to: string;
  subject: string;
  html?: string;
  text?: string;
}

export async function sendEmail({ to, subject, html, text }: SendEmailParams) {
  const client = getResend();
  if (!client) {
    console.log(`[EMAIL MOCK] To: ${to} | Subject: ${subject}`);
    return { success: true, mock: true };
  }

  const options: Record<string, unknown> = {
    from: "Intellee College <noreply@intellee.edu>",
    to,
    subject,
  };
  if (html) options.html = html;
  if (text) options.text = text;

  const result = await (client.emails.send as unknown as (opts: Record<string, unknown>) => Promise<unknown>)(options);

  return { success: true, data: result };
}

export function buildAssessmentInviteEmail(assessmentTitle: string, link: string) {
  return {
    subject: `New Assessment: ${assessmentTitle}`,
    html: `
      <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #4f46e5;">Intellee College</h2>
        <p>You have been assigned a new assessment:</p>
        <h3>${assessmentTitle}</h3>
        <p><a href="${link}" style="background: #4f46e5; color: white; padding: 12px 24px; border-radius: 8px; text-decoration: none; display: inline-block;">Take Assessment</a></p>
        <p style="color: #6b7280; font-size: 14px;">If the button doesn't work, copy this link: ${link}</p>
      </div>
    `,
  };
}

export function buildResultsEmail(studentName: string, assessmentTitle: string, score: number, total: number, percentage: number) {
  const passed = percentage >= 50;
  return {
    subject: `Results: ${assessmentTitle}`,
    html: `
      <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #4f46e5;">Intellee College</h2>
        <p>Dear ${studentName},</p>
        <p>Your results for <strong>${assessmentTitle}</strong> are now available:</p>
        <div style="background: ${passed ? "#f0fdf4" : "#fef2f2"}; border: 1px solid ${passed ? "#86efac" : "#fca5a5"}; border-radius: 8px; padding: 16px; margin: 16px 0;">
          <p style="font-size: 24px; font-weight: bold; margin: 0;">${score} / ${total}</p>
          <p style="margin: 4px 0;">${percentage}% — <strong style="color: ${passed ? "#16a34a" : "#dc2626"}">${passed ? "PASS" : "FAIL"}</strong></p>
        </div>
        <p>Log in to your dashboard to view detailed feedback.</p>
      </div>
    `,
  };
}
