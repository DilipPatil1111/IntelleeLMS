import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { sendEmail } from "@/lib/email";
import { resolveStudentEmails } from "@/lib/mail-audience";
import { NextResponse } from "next/server";

export async function GET() {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const list = await db.announcement.findMany({
    include: {
      creator: { select: { firstName: true, lastName: true } },
      program: { select: { name: true } },
      batch: { select: { name: true } },
      academicYear: { select: { name: true } },
      _count: { select: { recipients: true } },
    },
    orderBy: { createdAt: "desc" },
    take: 100,
  });

  return NextResponse.json({ announcements: list });
}

type Target = { id: string; email: string; kind: "student" | "teacher" };

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  const title = body.title as string;
  const textBody = body.body as string;

  let allPrograms = body.allPrograms === true;
  let allBatches = body.allBatches === true;
  let programIds = Array.isArray(body.programIds)
    ? (body.programIds as unknown[]).filter((x): x is string => typeof x === "string" && x.length > 0)
    : [];
  let batchIds = Array.isArray(body.batchIds)
    ? (body.batchIds as unknown[]).filter((x): x is string => typeof x === "string" && x.length > 0)
    : [];

  const legacyProgramId = typeof body.programId === "string" && body.programId ? body.programId : null;
  const legacyBatchId = typeof body.batchId === "string" && body.batchId ? body.batchId : null;
  if (legacyProgramId && programIds.length === 0 && body.allPrograms === undefined) {
    allPrograms = false;
    programIds = [legacyProgramId];
  }
  if (legacyBatchId && batchIds.length === 0 && body.allBatches === undefined) {
    allBatches = false;
    batchIds = [legacyBatchId];
  }

  const allTeachers = body.allTeachers === true;
  let teacherIds = Array.isArray(body.teacherIds)
    ? (body.teacherIds as unknown[]).filter((x): x is string => typeof x === "string" && x.length > 0)
    : [];

  const sendToStudents = body.sendToStudents !== false;
  const sendToTeachers = body.sendToTeachers === true;
  const recipientAll = body.recipientAll !== false;
  const studentIds = body.studentIds as string[] | undefined;

  const emailCopyToSender =
    body.emailCopyToSender === true || body.sendEmailCopyToSender === true || body.copyToSender === true;

  if (!title?.trim() || !textBody?.trim()) {
    return NextResponse.json({ error: "Title and body required" }, { status: 400 });
  }

  if (!sendToStudents && !sendToTeachers) {
    return NextResponse.json({ error: "Choose at least one audience: students and/or teachers" }, { status: 400 });
  }

  if (sendToStudents) {
    if (!allPrograms && programIds.length === 0) {
      return NextResponse.json(
        { error: "Select one or more programs, or enable All programs" },
        { status: 400 }
      );
    }
    if (!allBatches && batchIds.length === 0) {
      return NextResponse.json(
        { error: "Select one or more batches, or enable All batches" },
        { status: 400 }
      );
    }
    if (!recipientAll && (!studentIds || studentIds.length === 0)) {
      return NextResponse.json(
        { error: "Select specific students or enable sending to all students matching filters" },
        { status: 400 }
      );
    }
  }

  if (sendToTeachers) {
    if (!allTeachers && teacherIds.length === 0) {
      return NextResponse.json(
        { error: "Select one or more teachers, or enable All teachers" },
        { status: 400 }
      );
    }
  }

  const ann = await db.announcement.create({
    data: {
      title: title.trim(),
      body: textBody.trim(),
      createdById: session.user.id,
      programId: programIds[0] ?? legacyProgramId,
      batchId: batchIds[0] ?? legacyBatchId,
      academicYearId: null,
      recipientAll: sendToStudents ? recipientAll : false,
      sendEmail: true,
      emailCopyToSender,
      allPrograms,
      allBatches,
      programIds,
      batchIds,
      allTeachers,
      teacherIds,
      sendToStudents,
      sendToTeachers,
    },
  });

  let studentTargets: Target[] = [];
  let teacherTargets: Target[] = [];

  if (sendToStudents) {
    if (!recipientAll && studentIds?.length) {
      const rows = await db.user.findMany({
        where: { id: { in: studentIds }, role: "STUDENT", isActive: true },
        select: { id: true, email: true },
      });
      studentTargets = rows.map((r) => ({ ...r, kind: "student" as const }));
    } else {
      const emails = await resolveStudentEmails({
        allPrograms,
        allBatches,
        programIds,
        batchIds,
      });
      const users = await db.user.findMany({
        where: { email: { in: emails }, role: "STUDENT", isActive: true },
        select: { id: true, email: true },
      });
      studentTargets = users.map((r) => ({ ...r, kind: "student" as const }));
    }
  }

  if (sendToTeachers) {
    if (allTeachers) {
      const rows = await db.user.findMany({
        where: { role: "TEACHER", isActive: true },
        select: { id: true, email: true },
      });
      teacherTargets = rows.map((r) => ({ ...r, kind: "teacher" as const }));
    } else {
      const rows = await db.user.findMany({
        where: { id: { in: teacherIds }, role: "TEACHER", isActive: true },
        select: { id: true, email: true },
      });
      teacherTargets = rows.map((r) => ({ ...r, kind: "teacher" as const }));
    }
  }

  const seen = new Map<string, Target>();
  for (const t of studentTargets) seen.set(t.id, t);
  for (const t of teacherTargets) seen.set(t.id, t);
  const targets = [...seen.values()];

  if (targets.length) {
    await db.announcementRecipient.createMany({
      data: targets.map((t) => ({ announcementId: ann.id, userId: t.id })),
      skipDuplicates: true,
    });
  }

  const html = `<div style="font-family:sans-serif;max-width:600px;"><h2 style="color:#4f46e5;">Intellee College</h2><h3>${escapeHtml(title)}</h3><div>${escapeHtml(textBody).replace(/\n/g, "<br/>")}</div></div>`;
  const textPlain = `${title}\n\n${textBody}`;

  let emailsSent = 0;
  for (const t of targets) {
    try {
      await sendEmail({
        to: t.email,
        subject: `Announcement: ${title}`,
        html,
        text: textPlain,
      });
      emailsSent += 1;
    } catch {
      /* continue with notifications even if one address fails */
    }
    const link = t.kind === "teacher" ? "/teacher" : "/student/notifications";
    await db.notification
      .create({
        data: {
          userId: t.id,
          type: "ANNOUNCEMENT",
          title,
          message: textBody.slice(0, 280),
          link,
        },
      })
      .catch(() => {});
  }

  let senderCopySent = false;
  if (emailCopyToSender) {
    const creator = await db.user.findUnique({
      where: { id: session.user.id },
      select: { email: true },
    });
    if (creator?.email?.trim()) {
      try {
        await sendEmail({
          to: creator.email.trim(),
          subject: `[Copy] Announcement: ${title}`,
          html: `<p style="color:#64748b;font-size:14px;">This is a copy of the announcement email sent to recipients.</p>${html}`,
          text: `[Copy sent to you as publisher]\n\n${textPlain}`,
        });
        senderCopySent = true;
      } catch {
        /* non-fatal */
      }
    }
  }

  return NextResponse.json({
    announcement: ann,
    recipientCount: targets.length,
    studentCount: studentTargets.length,
    teacherCount: teacherTargets.length,
    emailsSent,
    senderCopySent,
  });
}

function escapeHtml(s: string) {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
