import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { NextResponse } from "next/server";

export async function PUT(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  const subject = await db.subject.update({
    where: { id },
    data: {
      name: body.name,
      code: body.code,
      description: body.description || null,
      credits: body.credits || 3,
    },
  });

  return NextResponse.json({ subject });
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  await db.subject.delete({ where: { id } });
  return NextResponse.json({ success: true });
}
