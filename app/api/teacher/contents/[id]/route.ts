import { requireTeacherPortal } from "@/lib/api-auth";
import { db } from "@/lib/db";
import { NextResponse } from "next/server";

export async function PUT(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const gate = await requireTeacherPortal();
  if (!gate.ok) return gate.response;
  const session = gate.session;

  const body = await req.json();
  const item = await db.topicContent.update({
    where: { id },
    data: {
      title: body.title,
      type: body.type,
      content: body.content || null,
      mediaUrl: body.mediaUrl || null,
      duration: body.duration || null,
      orderIndex: body.orderIndex ?? undefined,
    },
  });

  return NextResponse.json({ content: item });
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const gate2 = await requireTeacherPortal();
  if (!gate2.ok) return gate2.response;
  const session = gate2.session;

  await db.topicContent.delete({ where: { id } });
  return NextResponse.json({ success: true });
}
