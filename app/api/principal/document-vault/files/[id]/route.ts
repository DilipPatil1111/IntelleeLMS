import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { NextResponse } from "next/server";
import { blobDel } from "@/lib/vercel-blob";

export async function PUT(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const session = await auth();
  if (session?.user?.role !== "PRINCIPAL") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const file = await db.docFile.findUnique({ where: { id } });
  if (!file) {
    return NextResponse.json({ error: "File not found" }, { status: 404 });
  }

  const body = await req.json();
  const { fileName } = body as { fileName?: string };

  if (!fileName) {
    return NextResponse.json({ error: "fileName is required" }, { status: 400 });
  }

  const updated = await db.docFile.update({
    where: { id },
    data: { fileName },
  });

  return NextResponse.json({ file: updated });
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

  const file = await db.docFile.findUnique({ where: { id } });
  if (!file) {
    return NextResponse.json({ error: "File not found" }, { status: 404 });
  }

  await blobDel(file.fileUrl);
  await db.docFile.delete({ where: { id } });

  return NextResponse.json({ ok: true });
}
