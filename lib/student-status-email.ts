import { escapeHtml, escapeHtmlAttribute } from "@/lib/email";
import { sendEmailWithSignature } from "@/lib/email-signature";
import { getServerAppUrl } from "@/lib/app-url";
import type { StudentStatus } from "@/app/generated/prisma/enums";

function studentDashboardUrl(): string {
  const base = getServerAppUrl().replace(/\/$/, "");
  return `${base}/student`;
}

function onboardingUrl(): string {
  const base = getServerAppUrl().replace(/\/$/, "");
  return `${base}/student/onboarding`;
}

function notificationsUrl(): string {
  const base = getServerAppUrl().replace(/\/$/, "");
  return `${base}/student/notifications`;
}

function statusLabel(s: StudentStatus): string {
  const map: Record<StudentStatus, string> = {
    APPLIED: "Applied",
    ACCEPTED: "Accepted",
    ENROLLED: "Enrolled",
    COMPLETED: "Completed",
    GRADUATED: "Graduated",
    RETAKE: "Retake",
    CANCELLED: "Cancelled",
    SUSPENDED: "Suspended",
    EXPELLED: "Expelled",
    TRANSFERRED: "Transferred",
  };
  return map[s] ?? s;
}

/** Sends a transactional email when principal updates student enrollment status. */
export async function sendStudentStatusChangeEmail(params: {
  to: string;
  firstName: string;
  title: string;
  message: string;
  previousStatus: StudentStatus;
  nextStatus: StudentStatus;
  programName?: string | null;
  batchName?: string | null;
  enrollmentNo?: string | null;
}): Promise<void> {
  const { to, firstName, title, message, previousStatus, nextStatus, programName, batchName, enrollmentNo } = params;
  const dash = studentDashboardUrl();
  const notif = notificationsUrl();
  const onboard = onboardingUrl();
  const subj = `${title} — Intellee College`;

  const contextLines: string[] = [];
  contextLines.push(`<p style="font-size: 14px; color: #4b5563; margin: 0 0 12px;"><strong>Status change:</strong> ${escapeHtml(statusLabel(previousStatus))} → <strong>${escapeHtml(statusLabel(nextStatus))}</strong></p>`);
  if (programName?.trim()) {
    contextLines.push(`<p style="font-size: 14px; color: #374151; margin: 4px 0;"><strong>Program:</strong> ${escapeHtml(programName.trim())}</p>`);
  }
  if (batchName?.trim()) {
    contextLines.push(`<p style="font-size: 14px; color: #374151; margin: 4px 0;"><strong>Batch / class:</strong> ${escapeHtml(batchName.trim())}</p>`);
  }
  if (enrollmentNo?.trim()) {
    contextLines.push(`<p style="font-size: 14px; color: #374151; margin: 4px 0;"><strong>Enrollment number:</strong> ${escapeHtml(enrollmentNo.trim())}</p>`);
  }
  if (nextStatus === "ACCEPTED") {
    contextLines.push(
      `<p style="font-size: 13px; color: #6b7280; margin: 12px 0 0;">Complete onboarding when your placement is confirmed: <a href="${escapeHtmlAttribute(onboard)}" style="color: #4f46e5;">${escapeHtml(onboard)}</a></p>`
    );
  }
  if (nextStatus === "ENROLLED" && previousStatus === "ACCEPTED") {
    const programUrl = `${getServerAppUrl().replace(/\/$/, "")}/student/program`;
    contextLines.push(
      `<p style="font-size: 13px; color: #6b7280; margin: 12px 0 0;">Course content: <a href="${escapeHtmlAttribute(programUrl)}" style="color: #4f46e5;">${escapeHtml(programUrl)}</a></p>`
    );
  }

  const html = `
      <div style="font-family: system-ui, sans-serif; max-width: 600px; margin: 0 auto; color: #111827;">
        <div style="border-bottom: 3px solid #4f46e5; padding-bottom: 12px; margin-bottom: 20px;">
          <h1 style="margin: 0; font-size: 20px; color: #4f46e5;">Intellee College</h1>
          <p style="margin: 8px 0 0; font-size: 13px; color: #6b7280;">Enrollment update</p>
        </div>
        <p style="font-size: 16px;">Hello ${escapeHtml(firstName)},</p>
        <p style="font-size: 15px; line-height: 1.6;"><strong>${escapeHtml(title)}</strong></p>
        ${contextLines.join("")}
        <p style="font-size: 15px; line-height: 1.65; color: #374151; margin-top: 16px;">${escapeHtml(message)}</p>
        <p style="margin-top: 24px;">
          <a href="${escapeHtmlAttribute(dash)}" style="background: #4f46e5; color: #fff; padding: 12px 22px; border-radius: 8px; text-decoration: none; display: inline-block; font-weight: 600;">Open dashboard</a>
        </p>
        <p style="font-size: 13px; color: #6b7280; margin-top: 20px;">
          <a href="${escapeHtmlAttribute(notif)}" style="color: #4f46e5;">View notifications</a> in the portal for the full message.
        </p>
      </div>
    `;
  const text = `Hello ${firstName},\n\n${title}\n\nStatus: ${statusLabel(previousStatus)} → ${statusLabel(nextStatus)}\n${programName ? `Program: ${programName}\n` : ""}${batchName ? `Batch: ${batchName}\n` : ""}${enrollmentNo ? `Enrollment #: ${enrollmentNo}\n` : ""}\n${message}\n\nDashboard: ${dash}\nNotifications: ${notif}\n`;
  await sendEmailWithSignature({ to, subject: subj, html, text, senderUserId: null });
}

/** When principal changes program/batch without changing admission status (e.g. reallocation). */
export async function sendStudentProgramBatchChangeEmail(params: {
  to: string;
  firstName: string;
  programName: string | null;
  batchName: string | null;
  enrollmentNo?: string | null;
}): Promise<void> {
  const { to, firstName, programName, batchName, enrollmentNo } = params;
  const dash = studentDashboardUrl();
  const subj = "Your program or batch was updated — Intellee College";
  const html = `
      <div style="font-family: system-ui, sans-serif; max-width: 600px; margin: 0 auto; color: #111827;">
        <h1 style="font-size: 20px; color: #4f46e5;">Intellee College</h1>
        <p>Hello ${escapeHtml(firstName)},</p>
        <p>Your principal has updated your <strong>program or batch</strong> assignment in the system.</p>
        ${programName ? `<p><strong>Program:</strong> ${escapeHtml(programName)}</p>` : ""}
        ${batchName ? `<p><strong>Batch / class:</strong> ${escapeHtml(batchName)}</p>` : ""}
        ${enrollmentNo ? `<p><strong>Enrollment number:</strong> ${escapeHtml(enrollmentNo)}</p>` : ""}
        <p style="margin-top: 20px;"><a href="${escapeHtmlAttribute(dash)}" style="background: #4f46e5; color: #fff; padding: 12px 22px; border-radius: 8px; text-decoration: none; display: inline-block;">Open dashboard</a></p>
      </div>`;
  const text = `Hello ${firstName},\n\nYour program or batch was updated.\n${programName ? `Program: ${programName}\n` : ""}${batchName ? `Batch: ${batchName}\n` : ""}${enrollmentNo ? `Enrollment #: ${enrollmentNo}\n` : ""}\n${dash}\n`;
  await sendEmailWithSignature({ to, subject: subj, html, text, senderUserId: null });
}
