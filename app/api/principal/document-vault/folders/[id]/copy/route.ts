import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { NextResponse } from "next/server";

async function deepCopyFolder(sourceFolderId: string, targetParentId: string | null): Promise<void> {
  const source = await db.docFolder.findUnique({
    where: { id: sourceFolderId },
    include: { children: true },
  });
  if (!source) return;

  const copy = await db.docFolder.create({
    data: {
      name: source.name,
      parentId: targetParentId,
      scope: source.scope,
      yearId: source.yearId,
      programId: source.programId,
      batchId: source.batchId,
      isAutoPopulated: false,
      autoPopulateKey: null,
      sortOrder: source.sortOrder,
    },
  });

  for (const child of source.children) {
    await deepCopyFolder(child.id, copy.id);
  }
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
  const { targetParentId } = body as { targetParentId?: string | null };

  await deepCopyFolder(id, targetParentId ?? null);

  return NextResponse.json({ ok: true });
}
