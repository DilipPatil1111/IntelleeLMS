import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { NextResponse } from "next/server";
import { randomUUID } from "crypto";
import { blobPut } from "@/lib/vercel-blob";
import path from "path";

export const runtime = "nodejs";

const VAULT_ALLOWED_EXT = new Set([
  ".pdf", ".doc", ".docx", ".xls", ".xlsx", ".ppt", ".pptx",
  ".png", ".jpg", ".jpeg", ".gif", ".webp",
  ".txt", ".csv", ".zip", ".rar",
]);
const VAULT_MAX_BYTES = 50 * 1024 * 1024; // 50 MB

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
    const skipped: string[] = [];

    for (const entry of entries) {
      if (!(entry instanceof File)) continue;

      const ext = path.extname(entry.name).toLowerCase();
      if (!VAULT_ALLOWED_EXT.has(ext)) {
        skipped.push(`${entry.name}: unsupported file type "${ext}"`);
        continue;
      }
      if (entry.size > VAULT_MAX_BYTES) {
        skipped.push(`${entry.name}: exceeds 50 MB size limit`);
        continue;
      }

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

    if (created.length === 0 && skipped.length > 0) {
      return NextResponse.json(
        { error: "No files uploaded", skipped },
        { status: 400 },
      );
    }

    return NextResponse.json({ files: created, ...(skipped.length > 0 ? { skipped } : {}) });
  } catch (e) {
    console.error("[document-vault/folders files POST]", e);
    return NextResponse.json({ error: "Upload failed" }, { status: 500 });
  }
}
