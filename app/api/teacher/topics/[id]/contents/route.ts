import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { NextResponse } from "next/server";

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id: topicId } = await params;
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  const { title, type, content, mediaUrl, orderIndex, duration } = body;

  if (!title || !type) return NextResponse.json({ error: "Title and type are required" }, { status: 400 });

  const item = await db.topicContent.create({
    data: {
      topicId,
      title,
      type,
      content: content || null,
      mediaUrl: mediaUrl || null,
      duration: duration || null,
      orderIndex: orderIndex || 0,
    },
  });

  return NextResponse.json({ content: item });
}

export async function PUT(req: Request, { params }: { params: Promise<{ id: string }> }) {
  await params;
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  const { contentId, ...data } = body;

  if (!contentId) return NextResponse.json({ error: "contentId required" }, { status: 400 });

  const item = await db.topicContent.update({
    where: { id: contentId },
    data: {
      title: data.title,
      type: data.type,
      content: data.content || null,
      mediaUrl: data.mediaUrl || null,
      duration: data.duration || null,
      orderIndex: data.orderIndex ?? undefined,
    },
  });

  return NextResponse.json({ content: item });
}
