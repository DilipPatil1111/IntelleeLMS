import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { NextResponse } from "next/server";

export async function PUT(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const session = await auth();
  if (session?.user?.role !== "PRINCIPAL") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const existing = await db.inspectionNote.findUnique({ where: { id } });
  if (!existing) {
    return NextResponse.json({ error: "Note not found" }, { status: 404 });
  }

  const body = await req.json();
  const { note } = body as { note?: string };

  if (!note) {
    return NextResponse.json({ error: "note is required" }, { status: 400 });
  }

  const updated = await db.inspectionNote.update({
    where: { id },
    data: { note },
  });

  return NextResponse.json({ note: updated });
}

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const session = await auth();
  if (session?.user?.role !== "PRINCIPAL") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const existing = await db.inspectionNote.findUnique({ where: { id } });
  if (!existing) {
    return NextResponse.json({ error: "Note not found" }, { status: 404 });
  }

  await db.inspectionNote.delete({ where: { id } });

  return NextResponse.json({ ok: true });
}
