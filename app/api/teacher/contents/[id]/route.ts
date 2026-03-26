import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { NextResponse } from "next/server";

export async function PUT(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

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
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  await db.topicContent.delete({ where: { id } });
  return NextResponse.json({ success: true });
}
