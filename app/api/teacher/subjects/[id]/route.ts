import { requireTeacherPortal } from "@/lib/api-auth";
import { db } from "@/lib/db";
import { NextResponse } from "next/server";

export async function PUT(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const gate = await requireTeacherPortal();
  if (!gate.ok) return gate.response;
  const session = gate.session;

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
  const gate2 = await requireTeacherPortal();
  if (!gate2.ok) return gate2.response;
  const session = gate2.session;

  await db.subject.delete({ where: { id } });
  return NextResponse.json({ success: true });
}
