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
  /** Resend accepts Buffer or base64 string per attachment. */
  attachments?: { filename: string; content: Buffer }[];
  /**
   * Pre-built HTML signature block (from lib/email-signature.ts).
   * When provided it is appended after the main HTML body.
   * Pass `null` explicitly to suppress the signature for a specific email.
   */
  signatureHtml?: string | null;
  /**
   * Pre-built institution header HTML (logo + name, from lib/email-signature.ts buildEmailHeader()).
   * Replaces the `{INSTITUTION_HEADER}` placeholder in the HTML body.
   */
  headerHtml?: string | null;
}

export type SendEmailResult =
  | { ok: true; mock: true }
  | { ok: true; mock: false; id?: string }
  | { ok: false; error: string };

export async function sendEmail({ to, subject, html, text, attachments, signatureHtml, headerHtml }: SendEmailParams): Promise<SendEmailResult> {
  const client = getResendClient();
  if (!client) {
    console.warn(
      `[EMAIL] RESEND_API_KEY is not set or empty — email not sent to ${to}. In Vercel: add RESEND_API_KEY for Production, then Redeploy.`
    );
    return { ok: true, mock: true };
  }

  const baseHtml = html ?? (text ? `<p>${text.replace(/</g, "&lt;")}</p>` : "<p></p>");
  // Replace institution header placeholder, then append signature
  const FALLBACK_HEADER = `<h2 style="color: #4f46e5;">Intellee College</h2>`;
  const withHeader = headerHtml !== undefined
    ? baseHtml.replace(/\{INSTITUTION_HEADER\}/g, headerHtml ?? FALLBACK_HEADER)
    : baseHtml.replace(/\{INSTITUTION_HEADER\}/g, FALLBACK_HEADER);
  const htmlBody = signatureHtml ? `${withHeader}${signatureHtml}` : withHeader;
  const textBody = text ?? (html ? html.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim() : "");

  try {
    const result = await client.emails.send({
      from: getFromAddress(),
      to,
      subject,
      html: htmlBody,
      text: textBody || htmlBody.replace(/<[^>]+>/g, " ").trim() || "(no body)",
      ...(attachments?.length
        ? {
            attachments: attachments.map((a) => ({
              filename: a.filename,
              content: a.content,
            })),
          }
        : {}),
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
        {INSTITUTION_HEADER}
        <p>You have been assigned a new assessment:</p>
        <h3>${escapeHtml(assessmentTitle)}</h3>
        <p><a href="${escapeHtmlAttribute(link)}" style="background: #4f46e5; color: white; padding: 12px 24px; border-radius: 8px; text-decoration: none; display: inline-block;">Take Assessment</a></p>
        <p style="color: #6b7280; font-size: 14px;">If the button doesn't work, copy this link: ${escapeHtml(link)}</p>
      </div>
    `,
  };
}

export function escapeHtml(text: string): string {
  return text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

/** Safe for double-quoted HTML attributes (e.g. href). */
export function escapeHtmlAttribute(text: string): string {
  return text.replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;").replace(/\r?\n/g, "");
}

export function buildStudentWelcomeEmail(params: {
  firstName: string;
  email: string;
  temporaryPassword: string;
  loginUrl: string;
  /** Shown when admin placed the student in a program — onboarding opens after first login. */
  onboardingUrl?: string | null;
}) {
  const { firstName, email, temporaryPassword, loginUrl, onboardingUrl } = params;
  const href = escapeHtmlAttribute(loginUrl);
  const loginUrlVisible = escapeHtml(loginUrl);
  const ob = onboardingUrl?.trim();
  const hOb = ob ? escapeHtmlAttribute(ob) : "";
  const onboardingBlock = ob
    ? `<p style="color: #374151; font-size: 14px;">After you sign in and set your password, open <strong>Onboarding</strong> in the student portal to complete the enrollment checklist. Your principal will unlock full course access after review.</p>
        <p><a href="${hOb}" style="background: #059669; color: white; padding: 12px 24px; border-radius: 8px; text-decoration: none; display: inline-block;">Open Onboarding (after login)</a></p>`
    : "";
  const onboardingText = ob ? `\nAfter login, complete onboarding: ${ob}\n` : "";
  return {
    subject: "Your Intellee College account is ready",
    html: `
      <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto;">
        {INSTITUTION_HEADER}
        <p>Hello ${escapeHtml(firstName)},</p>
        <p>An administrator created your student account. Use the credentials below to sign in at the login page. You will be asked to set and confirm a new password before using the student dashboard.</p>
        <div style="background: #f3f4f6; border-radius: 8px; padding: 16px; margin: 16px 0;">
          <p style="margin: 0;"><strong>Email:</strong> ${escapeHtml(email)}</p>
          <p style="margin: 8px 0 0;"><strong>Temporary password:</strong> <code style="background: #e5e7eb; padding: 4px 8px; border-radius: 4px;">${escapeHtml(temporaryPassword)}</code></p>
        </div>
        <p><a href="${href}" style="background: #4f46e5; color: white; padding: 12px 24px; border-radius: 8px; text-decoration: none; display: inline-block;">Sign in</a></p>
        <p style="color: #374151; font-size: 14px;">If the button does not open the site, copy this address into your browser:</p>
        <p style="word-break: break-all; font-size: 14px; color: #1f2937;"><a href="${href}" style="color: #4f46e5;">${loginUrlVisible}</a></p>
        ${onboardingBlock}
        <p style="color: #6b7280; font-size: 13px;">For security, delete this email after you have saved your new password. Never share your password with anyone.</p>
      </div>
    `,
    text: `Hello ${firstName},\n\nYour account email: ${email}\nTemporary password: ${temporaryPassword}\n\nSign in:\n${loginUrl}\n\nYou must change your password after signing in.${onboardingText}`,
  };
}

export function buildRegistrationThankYouEmail(params: {
  firstName: string;
  programName: string;
  loginUrl: string;
}) {
  const { firstName, programName, loginUrl } = params;
  const href = escapeHtmlAttribute(loginUrl);
  return {
    subject: `Thank you for applying — ${programName}`,
    html: `
      <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto;">
        {INSTITUTION_HEADER}
        <p>Hello ${escapeHtml(firstName)},</p>
        <p>Thank you for applying to <strong>${escapeHtml(programName)}</strong>. We have received your application.</p>
        <p>Our admissions team will review it. You can sign in anytime to check your status under <strong>Apply</strong> in your student portal.</p>
        <p><a href="${href}" style="background: #4f46e5; color: white; padding: 12px 24px; border-radius: 8px; text-decoration: none; display: inline-block;">Open student portal</a></p>
        <pre style="margin:12px 0;padding:12px;background:#f9fafb;border:1px solid #e5e7eb;border-radius:8px;font-size:12px;white-space:pre-wrap;word-break:break-all;">${escapeHtml(loginUrl)}</pre>
        <p style="color:#6b7280;font-size:13px;">You will receive another email when your application is accepted or if we need more information.</p>
      </div>
    `,
    text: `Hello ${firstName},\n\nThank you for applying to ${programName}. We have received your application.\n\nPortal: ${loginUrl}\n`,
  };
}

export function buildEnrollmentOnboardingEmail(params: {
  firstName: string;
  programName: string;
  enrollmentNo: string;
  studentUrl: string;
  onboardingUrl: string;
}) {
  const { firstName, programName, enrollmentNo, studentUrl, onboardingUrl } = params;
  const h1 = escapeHtmlAttribute(studentUrl);
  const h2 = escapeHtmlAttribute(onboardingUrl);
  return {
    subject: `Enrollment confirmed — ${programName}`,
    html: `
      <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto;">
        {INSTITUTION_HEADER}
        <p>Dear ${escapeHtml(firstName)},</p>
        <p>Congratulations! Your enrollment in <strong>${escapeHtml(programName)}</strong> is confirmed.</p>
        <p><strong>Enrollment number:</strong> ${escapeHtml(enrollmentNo)}</p>
        <p><strong>Next steps — onboarding</strong></p>
        <ol style="padding-left: 20px; color: #374151;">
          <li>Student agreement — upload a signed copy if you have one, or mark the step complete in the portal for now.</li>
          <li>Government photo ID — upload when ready, or mark complete to proceed without a file (principal may request documents later).</li>
          <li>Fee payment proof — upload when ready, or mark complete for now.</li>
          <li>Pre-admission assessment — complete when assigned, or mark complete when applicable.</li>
        </ol>
        <p>When every step is marked done, your principal is notified to review and unlock full access. <strong>My Program</strong> and attendance unlock after that approval; you can still use Assessments and Results during onboarding.</p>
        <p><a href="${h2}" style="background: #4f46e5; color: white; padding: 12px 24px; border-radius: 8px; text-decoration: none; display: inline-block;">Go to Onboarding</a></p>
        <p><a href="${h1}" style="color: #4f46e5;">Student dashboard</a></p>
        <pre style="margin:12px 0;padding:12px;background:#f9fafb;border:1px solid #e5e7eb;border-radius:8px;font-size:12px;white-space:pre-wrap;word-break:break-all;">${escapeHtml(onboardingUrl)}</pre>
      </div>
    `,
    text: `Dear ${firstName},\n\nYour enrollment in ${programName} is confirmed. Enrollment #: ${enrollmentNo}\n\nComplete onboarding: ${onboardingUrl}\nDashboard: ${studentUrl}\n`,
  };
}

/** Email when principal creates a teacher account (optional subject/batch assignments). */
export function buildPrincipalTeacherInviteEmail(params: {
  firstName: string;
  email: string;
  temporaryPassword: string;
  loginUrl: string;
  assignmentLines: { programName: string; batchName: string; subjectName: string }[];
}) {
  const { firstName, email, temporaryPassword, loginUrl, assignmentLines } = params;
  const href = escapeHtmlAttribute(loginUrl);
  const loginUrlVisible = escapeHtml(loginUrl);
  const listHtml =
    assignmentLines.length > 0
      ? `<ul style="padding-left:20px;line-height:1.6;">${assignmentLines
          .map(
            (r) =>
              `<li><strong>${escapeHtml(r.subjectName)}</strong> — ${escapeHtml(r.programName)} — Batch: ${escapeHtml(r.batchName)}</li>`
          )
          .join("")}</ul>`
      : "<p><em>No subject/class row was added yet — your principal can assign you later.</em></p>";
  return {
    subject: "Your Intellee teacher account is ready",
    html: `
      <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto;">
        {INSTITUTION_HEADER}
        <p>Hello ${escapeHtml(firstName)},</p>
        <p>An administrator has created your <strong>teacher</strong> account. Below are your sign-in details and any program / batch / subject assignments.</p>
        ${listHtml}
        <div style="background: #f3f4f6; border-radius: 8px; padding: 16px; margin: 16px 0;">
          <p style="margin: 0;"><strong>Email:</strong> ${escapeHtml(email)}</p>
          <p style="margin: 8px 0 0;"><strong>Temporary password:</strong> <code style="background: #e5e7eb; padding: 4px 8px; border-radius: 4px;">${escapeHtml(temporaryPassword)}</code></p>
        </div>
        <p><a href="${href}" style="background: #4f46e5; color: white; padding: 12px 24px; border-radius: 8px; text-decoration: none; display: inline-block;">Sign in</a></p>
        <p style="color: #374151; font-size: 14px;"><strong>First sign-in:</strong> you will be asked to choose a new password and confirm it before accessing your teacher dashboard.</p>
        <p style="word-break: break-all; font-size: 14px; color: #6b7280;">${loginUrlVisible}</p>
      </div>
    `,
    text: `Hello ${firstName},\n\nYour teacher account was created.\nEmail: ${email}\nTemporary password: ${temporaryPassword}\n\nSign in: ${loginUrl}\n\nOn first login you must set a new password before using the teacher portal.\n`,
  };
}

/** Application rejected by admissions (program application, not student status enum). */
export function buildApplicationRejectedEmail(params: {
  firstName: string;
  programName: string;
  reviewNotes?: string | null;
  portalUrl: string;
}) {
  const { firstName, programName, reviewNotes, portalUrl } = params;
  const href = escapeHtmlAttribute(portalUrl);
  const note = reviewNotes?.trim();
  return {
    subject: `Update on your application — ${programName}`,
    html: `
      <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto;">
        {INSTITUTION_HEADER}
        <p>Hello ${escapeHtml(firstName)},</p>
        <p>Thank you for your interest in <strong>${escapeHtml(programName)}</strong>. After review, we are unable to offer admission for this intake.</p>
        ${note ? `<p style="color: #374151;"><strong>Note from admissions:</strong> ${escapeHtml(note)}</p>` : ""}
        <p>If you have questions, contact the admissions office. You may apply again in a future intake when applications open.</p>
        <p><a href="${href}" style="background: #4f46e5; color: white; padding: 12px 24px; border-radius: 8px; text-decoration: none; display: inline-block;">Open student portal</a></p>
        <p style="word-break: break-all; font-size: 13px; color: #6b7280;">${escapeHtml(portalUrl)}</p>
      </div>
    `,
    text: `Hello ${firstName},\n\nWe are unable to offer admission to ${programName} for this intake.${note ? `\n\nNote: ${note}` : ""}\n\nPortal: ${portalUrl}\n`,
  };
}

/** Teacher self-service registration completed. */
export function buildTeacherSelfRegistrationEmail(params: {
  firstName: string;
  loginUrl: string;
  programNames: string[];
}) {
  const { firstName, loginUrl, programNames } = params;
  const href = escapeHtmlAttribute(loginUrl);
  const list =
    programNames.length > 0
      ? `<ul style="padding-left:20px;">${programNames.map((n) => `<li>${escapeHtml(n)}</li>`).join("")}</ul>`
      : "<p><em>No programs were selected — your principal can link programs later.</em></p>";
  return {
    subject: "Welcome to Intellee College — teacher account created",
    html: `
      <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto;">
        {INSTITUTION_HEADER}
        <p>Hello ${escapeHtml(firstName)},</p>
        <p>Your <strong>teacher</strong> account has been created successfully. You can sign in with the email and password you used to register.</p>
        <p><strong>Programs you selected:</strong></p>
        ${list}
        <p><a href="${href}" style="background: #4f46e5; color: white; padding: 12px 24px; border-radius: 8px; text-decoration: none; display: inline-block;">Sign in to teacher portal</a></p>
        <p style="word-break: break-all; font-size: 13px; color: #6b7280;">${escapeHtml(loginUrl)}</p>
      </div>
    `,
    text: `Hello ${firstName},\n\nYour teacher account was created.\nPrograms: ${programNames.join(", ") || "None"}\n\nSign in: ${loginUrl}\n`,
  };
}

export function buildTeacherCoursesAssignedEmail(params: {
  firstName: string;
  rows: { programName: string; batchName: string; subjectName: string }[];
  loginUrl: string;
}) {
  const { firstName, rows, loginUrl } = params;
  const href = escapeHtmlAttribute(loginUrl);
  const listHtml = rows
    .map(
      (r) =>
        `<li><strong>${escapeHtml(r.subjectName)}</strong> — ${escapeHtml(r.programName)} — Batch: ${escapeHtml(r.batchName)}</li>`
    )
    .join("");
  const listText = rows.map((r) => `- ${r.subjectName} (${r.programName}, ${r.batchName})`).join("\n");
  return {
    subject: "You have been assigned to teach — Intellee College",
    html: `
      <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto;">
        {INSTITUTION_HEADER}
        <p>Hello ${escapeHtml(firstName)},</p>
        <p><strong>Congratulations!</strong> Your principal has assigned you to the following program and class work:</p>
        <ul style="line-height: 1.6;">${listHtml}</ul>
        <p>Sign in to your teacher portal to view your schedule, students, and course content.</p>
        <p><a href="${href}" style="background: #4f46e5; color: white; padding: 12px 24px; border-radius: 8px; text-decoration: none; display: inline-block;">Open teacher portal</a></p>
        <p style="word-break: break-all; font-size: 14px; color: #6b7280;">${escapeHtml(loginUrl)}</p>
      </div>
    `,
    text: `Hello ${firstName},\n\nCongratulations! You have been assigned to teach:\n\n${listText}\n\nTeacher portal: ${loginUrl}\n`,
  };
}

export function buildPasswordResetEmail(params: {
  firstName: string;
  resetUrl: string;
}) {
  const { firstName, resetUrl } = params;
  const href = escapeHtmlAttribute(resetUrl);
  return {
    subject: "Reset your password — Intellee College",
    html: `
      <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto;">
        {INSTITUTION_HEADER}
        <h2 style="color: #1f2937;">Password Reset Request</h2>
        <p style="color: #374151;">Hi ${escapeHtml(firstName)},</p>
        <p style="color: #374151;">We received a request to reset your password. Click the button below to set a new password:</p>
        <p style="margin: 24px 0;">
          <a href="${href}" style="background: #4f46e5; color: white; padding: 14px 28px; border-radius: 8px; text-decoration: none; display: inline-block; font-weight: 600;">
            Reset Password
          </a>
        </p>
        <p style="color: #6b7280; font-size: 14px;">This link expires in 1 hour. If you didn't request a password reset, you can safely ignore this email.</p>
        <p style="color: #6b7280; font-size: 13px;">If the button doesn't work, copy and paste this link into your browser:<br/>${escapeHtml(resetUrl)}</p>
      </div>
    `,
    text: `Hi ${firstName},\n\nWe received a request to reset your password. Visit the following link to set a new password:\n\n${resetUrl}\n\nThis link expires in 1 hour. If you didn't request this, ignore this email.\n`,
  };
}

export function buildResultsEmail(studentName: string, assessmentTitle: string, score: number, total: number, percentage: number) {
  const passed = percentage >= 50;
  return {
    subject: `Results: ${assessmentTitle}`,
    html: `
      <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto;">
        {INSTITUTION_HEADER}
        <p>Dear ${escapeHtml(studentName)},</p>
        <p>Your results for <strong>${escapeHtml(assessmentTitle)}</strong> are now available:</p>
        <div style="background: ${passed ? "#f0fdf4" : "#fef2f2"}; border: 1px solid ${passed ? "#86efac" : "#fca5a5"}; border-radius: 8px; padding: 16px; margin: 16px 0;">
          <p style="font-size: 24px; font-weight: bold; margin: 0;">${score} / ${total}</p>
          <p style="margin: 4px 0;">${percentage}% — <strong style="color: ${passed ? "#16a34a" : "#dc2626"}">${passed ? "PASS" : "FAIL"}</strong></p>
        </div>
        <p>Log in to your dashboard to view detailed feedback.</p>
      </div>
    `,
  };
}
