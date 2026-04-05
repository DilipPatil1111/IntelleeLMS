import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { NextResponse } from "next/server";
import { blobDel, blobPut } from "@/lib/vercel-blob";
import { randomUUID } from "crypto";

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const session = await auth();
  if (session?.user?.role !== "PRINCIPAL") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const existing = await db.docFile.findUnique({ where: { id } });
  if (!existing) {
    return NextResponse.json({ error: "File not found" }, { status: 404 });
  }

  const formData = await req.formData();
  const file = formData.get("file") as File | null;
  if (!file) {
    return NextResponse.json({ error: "No file provided" }, { status: 400 });
  }

  try {
    await blobDel(existing.fileUrl);
  } catch {
    /* blob may already be removed */
  }

  const ext = file.name.includes(".")
    ? file.name.substring(file.name.lastIndexOf("."))
    : "";
  const blobPath = `document-vault/${existing.folderId}/${randomUUID()}${ext}`;
  const blob = await blobPut(blobPath, file, { access: "public" });

  const updated = await db.docFile.update({
    where: { id },
    data: {
      fileName: file.name,
      fileUrl: blob.url,
      fileSize: file.size,
      contentType: file.type || "application/octet-stream",
    },
  });

  return NextResponse.json({ file: updated });
}
