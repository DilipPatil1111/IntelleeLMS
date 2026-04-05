import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { NextResponse } from "next/server";

export async function GET(
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

  const notes = await db.inspectionNote.findMany({
    where: { folderId: id },
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json({ notes });
}

export async function POST(
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
  const { note } = body as { note?: string };

  if (!note) {
    return NextResponse.json({ error: "note is required" }, { status: 400 });
  }

  const created = await db.inspectionNote.create({
    data: { folderId: id, note },
  });

  return NextResponse.json({ note: created });
}
