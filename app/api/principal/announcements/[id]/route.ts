import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { NextResponse } from "next/server";

export async function PUT(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

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
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  await db.announcementRecipient.deleteMany({ where: { announcementId: id } });
  await db.announcement.delete({ where: { id } });
  return NextResponse.json({ success: true });
}
