import { Resend } from "resend";
import { env } from "@/lib/env";

/**
 * Read at send time (not build time). Bracket access avoids some bundlers inlining
 * `process.env.RESEND_API_KEY` as undefined when the key was added only on the host (e.g. Vercel).
 */
function getResendApiKey(): string | undefined {
  const raw = process.env["RESEND_API_KEY"];
  if (typeof raw !== "string") return undefined;
  const trimmed = raw.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

function getResendClient(): Resend | null {
  const key = getResendApiKey();
  if (!key) return null;
  return new Resend(key);
}

/** Default Resend test sender (only works for your own account email). Use RESEND_FROM_EMAIL after domain verification. */
const DEFAULT_FROM = "Intellee College <onboarding@resend.dev>";

function getFromAddress(): string {
  const configured = env.RESEND_FROM_EMAIL?.trim();
  if (configured) return configured;
  return DEFAULT_FROM;
}

interface SendEmailParams {
  to: string;
  subject: string;
  html?: string;
  text?: string;
}

export type SendEmailResult =
  | { ok: true; mock: true }
  | { ok: true; mock: false; id?: string }
  | { ok: false; error: string };

export async function sendEmail({ to, subject, html, text }: SendEmailParams): Promise<SendEmailResult> {
  const client = getResendClient();
  if (!client) {
    console.warn(
      `[EMAIL] RESEND_API_KEY is not set or empty — email not sent to ${to}. In Vercel: add RESEND_API_KEY for Production, then Redeploy.`
    );
    return { ok: true, mock: true };
  }

  const htmlBody = html ?? (text ? `<p>${text.replace(/</g, "&lt;")}</p>` : "<p></p>");
  const textBody = text ?? (html ? html.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim() : "");

  try {
    const result = await client.emails.send({
      from: getFromAddress(),
      to,
      subject,
      html: htmlBody,
      text: textBody || htmlBody.replace(/<[^>]+>/g, " ").trim() || "(no body)",
    });
    if (result.error) {
      const errMsg = result.error.message || "Resend rejected the send";
      console.error("[EMAIL] Resend error:", result.error);
      return { ok: false, error: errMsg };
    }
    return { ok: true, mock: false, id: result.data?.id };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error("[EMAIL] Send exception:", msg);
    return { ok: false, error: msg };
  }
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

function escapeHtml(text: string): string {
  return text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

/** Safe for double-quoted HTML attributes (e.g. href). */
function escapeHtmlAttribute(text: string): string {
  return text.replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;").replace(/\r?\n/g, "");
}

export function buildStudentWelcomeEmail(params: {
  firstName: string;
  email: string;
  temporaryPassword: string;
  loginUrl: string;
}) {
  const { firstName, email, temporaryPassword, loginUrl } = params;
  const href = escapeHtmlAttribute(loginUrl);
  const loginUrlVisible = escapeHtml(loginUrl);
  return {
    subject: "Your Intellee College account is ready",
    html: `
      <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #4f46e5;">Intellee College</h2>
        <p>Hello ${escapeHtml(firstName)},</p>
        <p>An administrator created your student account. Use the credentials below to sign in at the login page. You will be asked to set and confirm a new password before using the student dashboard.</p>
        <div style="background: #f3f4f6; border-radius: 8px; padding: 16px; margin: 16px 0;">
          <p style="margin: 0;"><strong>Email:</strong> ${escapeHtml(email)}</p>
          <p style="margin: 8px 0 0;"><strong>Temporary password:</strong> <code style="background: #e5e7eb; padding: 4px 8px; border-radius: 4px;">${escapeHtml(temporaryPassword)}</code></p>
        </div>
        <p><a href="${href}" style="background: #4f46e5; color: white; padding: 12px 24px; border-radius: 8px; text-decoration: none; display: inline-block;">Sign in</a></p>
        <p style="color: #374151; font-size: 14px;">If the button does not open the site, copy this address into your browser:</p>
        <p style="word-break: break-all; font-size: 14px; color: #1f2937;"><a href="${href}" style="color: #4f46e5;">${loginUrlVisible}</a></p>
        <p style="color: #6b7280; font-size: 13px;">For security, delete this email after you have saved your new password. Never share your password with anyone.</p>
      </div>
    `,
    text: `Hello ${firstName},\n\nYour account email: ${email}\nTemporary password: ${temporaryPassword}\n\nSign in (copy this link into your browser if needed):\n${loginUrl}\n\nYou must change your password after signing in.`,
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
