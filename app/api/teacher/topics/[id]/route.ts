import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { NextResponse } from "next/server";

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const topic = await db.topic.findUnique({
    where: { id },
    include: {
      module: { include: { subject: true } },
      contents: { orderBy: { orderIndex: "asc" } },
      assessments: { select: { id: true, title: true, type: true, status: true } },
    },
  });

  if (!topic) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json({ topic });
}

export async function PUT(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  const topic = await db.topic.update({
    where: { id },
    data: {
      name: body.name,
      description: body.description || null,
      orderIndex: body.orderIndex ?? undefined,
      isPublished: body.isPublished ?? undefined,
    },
  });

  return NextResponse.json({ topic });
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  await db.topic.delete({ where: { id } });
  return NextResponse.json({ success: true });
}
