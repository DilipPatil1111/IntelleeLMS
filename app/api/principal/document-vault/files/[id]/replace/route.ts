import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { NextResponse } from "next/server";
import { blobDel, blobPut } from "@/lib/vercel-blob";
import { randomUUID } from "crypto";
import path from "path";

export const runtime = "nodejs";

const VAULT_ALLOWED_EXT = new Set([
  ".pdf", ".doc", ".docx", ".xls", ".xlsx", ".ppt", ".pptx",
  ".png", ".jpg", ".jpeg", ".gif", ".webp",
  ".txt", ".csv", ".zip", ".rar",
]);
const VAULT_MAX_BYTES = 50 * 1024 * 1024; // 50 MB

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

  const ext = path.extname(file.name).toLowerCase();
  if (!VAULT_ALLOWED_EXT.has(ext)) {
    return NextResponse.json(
      { error: `File type "${ext}" is not allowed. Accepted: ${[...VAULT_ALLOWED_EXT].join(", ")}` },
      { status: 400 },
    );
  }
  if (file.size > VAULT_MAX_BYTES) {
    return NextResponse.json(
      { error: `File exceeds the 50 MB size limit.` },
      { status: 400 },
    );
  }

  try {
    await blobDel(existing.fileUrl);
  } catch {
    /* blob may already be removed */
  }

  const blobPath = `document-vault/${existing.folderId}/${randomUUID()}${ext}`;
  const blob = await blobPut(blobPath, file);

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
