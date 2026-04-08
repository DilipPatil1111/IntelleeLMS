import { requireTeacherPortal } from "@/lib/api-auth";
import { db } from "@/lib/db";
import { sendEmailWithSignature } from "@/lib/email-signature";
import { resolveStudentEmails } from "@/lib/mail-audience";
import { isTeacherOwnershipRestricted } from "@/lib/portal-access";
import { NextResponse } from "next/server";

export async function GET(req: Request) {
  const gate = await requireTeacherPortal();
  if (!gate.ok) return gate.response;
  const session = gate.session;

  let where: Record<string, unknown>;

  if (!isTeacherOwnershipRestricted(session)) {
    where = {};
  } else {
    const profile = await db.teacherProfile.findUnique({
      where: { userId: session.user.id },
      include: { teacherPrograms: true },
    });
    const programIds = profile?.teacherPrograms.map((tp) => tp.programId) || [];
    where = {
      OR: [{ programId: { in: programIds } }, { createdById: session.user.id }],
    };
  }

  const { searchParams } = new URL(req.url);
  const page = Math.max(1, Number.parseInt(searchParams.get("page") || "1", 10) || 1);
  let pageSize = Number.parseInt(searchParams.get("pageSize") || "10", 10) || 10;
  pageSize = Math.min(Math.max(1, pageSize), 50);

  const [total, list] = await Promise.all([
    db.announcement.count({ where }),
    db.announcement.findMany({
      where,
      include: {
        creator: { select: { firstName: true, lastName: true } },
        program: { select: { name: true } },
        batch: { select: { name: true } },
      },
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
  ]);

  return NextResponse.json({ announcements: list, total, page, pageSize });
}

export async function POST(req: Request) {
  const gate2 = await requireTeacherPortal();
  if (!gate2.ok) return gate2.response;
  const session = gate2.session;

  const body = await req.json();
  const {
    title,
    body: textBody,
    programId,
    batchId,
    recipientAll,
    studentIds,
  } = body as Record<string, unknown>;

  if (!title || !textBody || typeof title !== "string" || typeof textBody !== "string") {
    return NextResponse.json({ error: "Title and body required" }, { status: 400 });
  }

  if (typeof programId !== "string" || !programId) {
    return NextResponse.json({ error: "Program is required" }, { status: 400 });
  }

  if (isTeacherOwnershipRestricted(session)) {
    const profile = await db.teacherProfile.findUnique({
      where: { userId: session.user.id },
      include: { teacherPrograms: true },
    });
    if (!profile) return NextResponse.json({ error: "No teacher profile" }, { status: 400 });
    if (!profile.teacherPrograms.some((tp) => tp.programId === programId)) {
      return NextResponse.json({ error: "Program not assigned to you" }, { status: 403 });
    }
  } else {
    const prog = await db.program.findUnique({ where: { id: programId } });
    if (!prog) return NextResponse.json({ error: "Program not found" }, { status: 404 });
  }

  const ann = await db.announcement.create({
    data: {
      title,
      body: textBody as string,
      createdById: session.user.id,
      programId,
      batchId: typeof batchId === "string" ? batchId : null,
      recipientAll: recipientAll !== false,
      sendEmail: true,
    },
  });

  let targets: { id: string; email: string }[] = [];

  if (recipientAll === false && Array.isArray(studentIds) && studentIds.length) {
    targets = await db.user.findMany({
      where: { id: { in: studentIds as string[] }, role: "STUDENT" },
      select: { id: true, email: true },
    });
    await db.announcementRecipient.createMany({
      data: targets.map((t) => ({ announcementId: ann.id, userId: t.id })),
      skipDuplicates: true,
    });
  } else {
    const emails = await resolveStudentEmails({
      programId: typeof programId === "string" ? programId : null,
      batchId: typeof batchId === "string" ? batchId : null,
    });
    targets = await db.user.findMany({
      where: { email: { in: emails }, role: "STUDENT", isActive: true },
      select: { id: true, email: true },
    });
  }

  for (const t of targets) {
    await sendEmailWithSignature({
      to: t.email,
      subject: `Announcement: ${title}`,
      html: `<p><strong>${title}</strong></p><p>${String(textBody).replace(/\n/g, "<br/>")}</p>`,
      text: `${title}\n\n${textBody}`,
      senderUserId: session.user.id,
    });
    await db.notification
      .create({
        data: {
          userId: t.id,
          type: "ANNOUNCEMENT",
          title: title as string,
          message: String(textBody).slice(0, 200),
          link: "/student/notifications",
        },
      })
      .catch((err: unknown) => {
        console.error("[teacher/announcements] Failed to create notification:", err);
      });
  }

  return NextResponse.json({ announcement: ann, sent: targets.length });
}
