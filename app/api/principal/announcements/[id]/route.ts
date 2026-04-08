import { requirePrincipalPortal } from "@/lib/api-auth";
import { db } from "@/lib/db";
import { NextResponse } from "next/server";

export async function PUT(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const gate = await requirePrincipalPortal();
  if (!gate.ok) return gate.response;
  const session = gate.session;

  const body = await req.json();
  const ann = await db.announcement.update({
    where: { id },
    data: {
      title: body.title,
      body: body.body,
      programId: body.programId ?? undefined,
      batchId: body.batchId ?? undefined,
      academicYearId: body.academicYearId ?? undefined,
      recipientAll: body.recipientAll,
    },
  });

  return NextResponse.json({ announcement: ann });
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const gate2 = await requirePrincipalPortal();
  if (!gate2.ok) return gate2.response;
  const session = gate2.session;

  await db.announcementRecipient.deleteMany({ where: { announcementId: id } });
  await db.announcement.delete({ where: { id } });
  return NextResponse.json({ success: true });
}
