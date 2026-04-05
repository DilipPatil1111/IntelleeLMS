import { db } from "@/lib/db";
import { buildTeacherCoursesAssignedEmail, escapeHtml, escapeHtmlAttribute } from "@/lib/email";
import { sendEmailWithSignature } from "@/lib/email-signature";
import { getServerAppUrl } from "@/lib/app-url";

type SnapshotRow = { subjectId: string; batchId: string };

export type TeacherTeachingSnapshot = {
  programIds: string[];
  assignments: SnapshotRow[];
};

export function serializeTeacherSnapshot(programIds: string[], assignments: SnapshotRow[]): string {
  return JSON.stringify({
    p: [...programIds].sort(),
    a: assignments.map((r) => `${r.subjectId}:${r.batchId}`).sort(),
  });
}

/** After principal updates teacher programs/assignments, email the teacher when anything changed (including first assignment). */
export async function emailTeacherIfTeachingChanged(
  teacherUserId: string,
  teacherProfileId: string,
  before: TeacherTeachingSnapshot
) {
  const [programsNow, assignsNow] = await Promise.all([
    db.teacherProgram.findMany({
      where: { teacherProfileId },
      include: { program: true },
    }),
    db.teacherSubjectAssignment.findMany({
      where: { teacherProfileId },
      include: { subject: true, batch: { include: { program: true } } },
    }),
  ]);

  const after: TeacherTeachingSnapshot = {
    programIds: programsNow.map((p) => p.programId),
    assignments: assignsNow.map((a) => ({ subjectId: a.subjectId, batchId: a.batchId })),
  };

  if (serializeTeacherSnapshot(before.programIds, before.assignments) === serializeTeacherSnapshot(after.programIds, after.assignments)) {
    return;
  }

  const user = await db.user.findUnique({
    where: { id: teacherUserId },
    select: { email: true, firstName: true },
  });
  if (!user?.email) return;

  const base = getServerAppUrl().replace(/\/$/, "");
  const loginUrl = `${base}/teacher`;
  const programList = programsNow.map((p) => p.program.name).filter(Boolean);
  const rows = assignsNow.map((r) => ({
    programName: r.batch.program.name,
    batchName: r.batch.name,
    subjectName: r.subject.name,
  }));

  const hadAssignments = before.assignments.length > 0;
  const hasAssignments = assignsNow.length > 0;
  const firstEver = !hadAssignments && hasAssignments;

  const progKey = (ids: string[]) => [...ids].sort().join(",");
  const programsDifferent = progKey(before.programIds) !== progKey(after.programIds);

  if (firstEver) {
    const payload = buildTeacherCoursesAssignedEmail({
      firstName: user.firstName,
      rows,
      loginUrl,
    });
    await sendEmailWithSignature({ to: user.email, subject: payload.subject, html: payload.html, text: payload.text, senderUserId: null });
    return;
  }

  /** Only program checkboxes changed; no subject/batch rows on either side. */
  if (!hadAssignments && !hasAssignments && programsDifferent) {
    const subj = "Your linked programs were updated — Intellee College";
    const href = escapeHtmlAttribute(loginUrl);
    const html = `
      <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto;">
        {INSTITUTION_HEADER}
        <p>Hello ${escapeHtml(user.firstName)},</p>
        <p>Your principal has updated which <strong>programs</strong> are linked to your teacher profile.</p>
        <p style="font-size: 14px; color: #374151;"><strong>Programs now:</strong> ${programList.length ? programList.map((n) => escapeHtml(n)).join(", ") : "None"}</p>
        <p><a href="${href}" style="background: #4f46e5; color: white; padding: 12px 24px; border-radius: 8px; text-decoration: none; display: inline-block;">Open teacher portal</a></p>
      </div>`;
    const text = `Hello ${user.firstName},\n\nYour linked programs were updated.\n\nPrograms: ${programList.join(", ") || "None"}\n\n${loginUrl}\n`;
    await sendEmailWithSignature({ to: user.email, subject: subj, html, text, senderUserId: null });
    return;
  }

  if (hasAssignments) {
    const listHtml = rows
      .map(
        (r) =>
          `<li><strong>${escapeHtml(r.subjectName)}</strong> — ${escapeHtml(r.programName)} — Batch: ${escapeHtml(r.batchName)}</li>`
      )
      .join("");
    const listText = rows.map((r) => `- ${r.subjectName} (${r.programName}, ${r.batchName})`).join("\n");
    const subj = "Your teaching assignments were updated — Intellee College";
    const href = escapeHtmlAttribute(loginUrl);
    const html = `
      <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto;">
        {INSTITUTION_HEADER}
        <p>Hello ${escapeHtml(user.firstName)},</p>
        <p>Your principal has updated your <strong>subject and batch</strong> assignments. Your current list is below.</p>
        <ul style="line-height: 1.6;">${listHtml}</ul>
        <p style="font-size: 14px; color: #374151;"><strong>Programs linked to your profile:</strong> ${programList.length ? programList.map((n) => escapeHtml(n)).join(", ") : "None"}</p>
        <p><a href="${href}" style="background: #4f46e5; color: white; padding: 12px 24px; border-radius: 8px; text-decoration: none; display: inline-block;">Open teacher portal</a></p>
      </div>`;
    const text = `Hello ${user.firstName},\n\nYour teaching assignments were updated.\n\nPrograms: ${programList.join(", ") || "None"}\n\n${listText}\n\n${loginUrl}\n`;
    await sendEmailWithSignature({ to: user.email, subject: subj, html, text, senderUserId: null });
    return;
  }

  /** All subject/batch rows removed; programs may still be set. */
  const subj = "Your class assignments were removed — Intellee College";
  const href2 = escapeHtmlAttribute(loginUrl);
  const html = `
    <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto;">
      {INSTITUTION_HEADER}
      <p>Hello ${escapeHtml(user.firstName)},</p>
      <p>Your principal has removed all <strong>subject and batch</strong> teaching assignments from your profile.</p>
      <p style="font-size: 14px; color: #374151;"><strong>Programs still linked:</strong> ${programList.length ? programList.map((n) => escapeHtml(n)).join(", ") : "None"}</p>
      <p>If this is unexpected, contact your administrator.</p>
      <p><a href="${href2}" style="background: #4f46e5; color: white; padding: 12px 24px; border-radius: 8px; text-decoration: none; display: inline-block;">Open teacher portal</a></p>
    </div>`;
  const text = `Hello ${user.firstName},\n\nAll subject/batch assignments were removed from your profile.\nPrograms: ${programList.join(", ") || "None"}\n\n${loginUrl}\n`;
  await sendEmailWithSignature({ to: user.email, subject: subj, html, text, senderUserId: null });
}
