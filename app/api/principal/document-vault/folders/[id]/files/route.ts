import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { NextResponse } from "next/server";
import { randomUUID } from "crypto";
import { blobPut } from "@/lib/vercel-blob";

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

  const files = await db.docFile.findMany({
    where: { folderId: id },
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json({ files });
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

  try {
    const formData = await req.formData();
    const entries = formData.getAll("files");

    if (entries.length === 0) {
      return NextResponse.json({ error: "No files provided" }, { status: 400 });
    }

    const created = [];

    for (const entry of entries) {
      if (!(entry instanceof File)) continue;

      const ext = entry.name.includes(".")
        ? entry.name.substring(entry.name.lastIndexOf("."))
        : "";
      const blobPath = `document-vault/${id}/${randomUUID()}${ext}`;

      const blob = await blobPut(blobPath, entry);

      const docFile = await db.docFile.create({
        data: {
          folderId: id,
          fileName: entry.name,
          fileUrl: blob.url,
          fileSize: entry.size,
          contentType: entry.type || "application/octet-stream",
        },
      });

      created.push(docFile);
    }

    return NextResponse.json({ files: created });
  } catch (e) {
    console.error("[document-vault/folders files POST]", e);
    const message = e instanceof Error ? e.message : "Upload failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
