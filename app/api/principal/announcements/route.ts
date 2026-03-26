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

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  const title = body.title as string;
  const textBody = body.body as string;
  const programId = body.programId as string | undefined;
  const batchId = body.batchId as string | undefined;
  const academicYearId = body.academicYearId as string | undefined;
  const recipientAll = body.recipientAll !== false;
  const studentIds = body.studentIds as string[] | undefined;
  const shouldSend = body.sendEmail !== false;

  if (!title?.trim() || !textBody?.trim()) {
    return NextResponse.json({ error: "Title and body required" }, { status: 400 });
  }

  const ann = await db.announcement.create({
    data: {
      title: title.trim(),
      body: textBody.trim(),
      createdById: session.user.id,
      programId: programId || null,
      batchId: batchId || null,
      academicYearId: academicYearId || null,
      recipientAll,
      sendEmail: shouldSend,
    },
  });

  let targets: { id: string; email: string }[] = [];

  if (!recipientAll && studentIds?.length) {
    targets = await db.user.findMany({
      where: { id: { in: studentIds }, role: "STUDENT", isActive: true },
      select: { id: true, email: true },
    });
    if (targets.length) {
      await db.announcementRecipient.createMany({
        data: targets.map((t) => ({ announcementId: ann.id, userId: t.id })),
        skipDuplicates: true,
      });
    }
  } else {
    const emails = await resolveStudentEmails({
      programId: programId || null,
      batchId: batchId || null,
      academicYearId: academicYearId || null,
      currentYearOnly: !batchId && !programId && !academicYearId,
    });
    const users = await db.user.findMany({
      where: { email: { in: emails }, role: "STUDENT", isActive: true },
      select: { id: true, email: true },
    });
    targets = users;
  }

  const html = `<div style="font-family:sans-serif;max-width:600px;"><h2 style="color:#4f46e5;">Intellee College</h2><h3>${escapeHtml(title)}</h3><div>${escapeHtml(textBody).replace(/\n/g, "<br/>")}</div></div>`;

  for (const t of targets) {
    if (shouldSend) {
      await sendEmail({
        to: t.email,
        subject: `Announcement: ${title}`,
        html,
        text: `${title}\n\n${textBody}`,
      });
    }
    await db.notification
      .create({
        data: {
          userId: t.id,
          type: "ANNOUNCEMENT",
          title,
          message: textBody.slice(0, 280),
          link: "/student/notifications",
        },
      })
      .catch(() => {});
  }

  return NextResponse.json({ announcement: ann, sent: targets.length });
}

function escapeHtml(s: string) {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
