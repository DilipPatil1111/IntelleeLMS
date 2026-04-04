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

  const folder = await db.docFolder.findUnique({ where: { id } });
  if (!folder) {
    return NextResponse.json({ error: "Folder not found" }, { status: 404 });
  }

  const body = await req.json();
  const { name } = body as { name?: string };

  if (!name) {
    return NextResponse.json({ error: "name is required" }, { status: 400 });
  }

  const updated = await db.docFolder.update({
    where: { id },
    data: { name },
  });

  return NextResponse.json({ folder: updated });
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

  const folder = await db.docFolder.findUnique({ where: { id } });
  if (!folder) {
    return NextResponse.json({ error: "Folder not found" }, { status: 404 });
  }

  if (folder.isAutoPopulated) {
    return NextResponse.json(
      { error: "Cannot delete auto-populated folders" },
      { status: 403 },
    );
  }

  await db.docFolder.delete({ where: { id } });

  return NextResponse.json({ ok: true });
}
