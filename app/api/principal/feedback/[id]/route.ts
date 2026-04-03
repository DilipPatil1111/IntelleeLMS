import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { sendFeedbackReplyEmail } from "@/lib/feedback-email";
import { hasPrincipalPortalAccess } from "@/lib/portal-access";
import { NextResponse } from "next/server";

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  if (!hasPrincipalPortalAccess(session)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await req.json();
  const principalReply = typeof body.principalReply === "string" ? body.principalReply.trim() : "";
  if (principalReply.length < 3) {
    return NextResponse.json({ error: "Reply must be at least 3 characters." }, { status: 400 });
  }

  const existing = await db.feedback.findUnique({
    where: { id },
    include: { author: { select: { email: true, firstName: true } } },
  });
  if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });

  await db.feedback.update({
    where: { id },
    data: {
      principalReply,
      repliedAt: new Date(),
      repliedById: session.user.id,
    },
  });

  const link = existing.authorRole === "TEACHER" ? "/teacher/feedback" : "/student/feedback";
  const msg =
    principalReply.length > 450 ? `${principalReply.slice(0, 447)}…` : principalReply;

  await db.notification.create({
    data: {
      userId: existing.authorId,
      type: "FEEDBACK_REPLY",
      title: "Feedback — action taken",
      message: msg,
      link,
    },
  });

  if (existing.author.email) {
    await sendFeedbackReplyEmail({
      to: existing.author.email,
      recipientFirstName: existing.author.firstName,
      reply: principalReply,
    });
  }

  return NextResponse.json({ success: true });
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  if (!hasPrincipalPortalAccess(session)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  try {
    await db.feedback.delete({ where: { id } });
  } catch {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  return NextResponse.json({ success: true });
}
