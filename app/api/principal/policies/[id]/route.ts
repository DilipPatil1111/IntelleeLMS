import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { NextResponse } from "next/server";

export async function PUT(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  const policy = await db.policy.update({
    where: { id },
    data: {
      title: body.title,
      description: body.description || null,
      content: body.content || null,
      fileUrl: body.fileUrl || null,
      category: body.category || null,
      isActive: body.isActive ?? true,
    },
  });

  return NextResponse.json({ policy });
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  await db.policy.delete({ where: { id } });
  return NextResponse.json({ success: true });
}
