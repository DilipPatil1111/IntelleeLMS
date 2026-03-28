import { auth } from "@/lib/auth";
import { mkdir, writeFile } from "fs/promises";
import path from "path";
import { NextResponse } from "next/server";

export const runtime = "nodejs";

const MAX_BYTES = 8 * 1024 * 1024;
const ALLOWED = new Set([".pdf", ".doc", ".docx"]);

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const role = (session.user as unknown as Record<string, unknown>).role as string;
  if (role !== "PRINCIPAL") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const formData = await req.formData();
  const file = formData.get("file") as File | null;
  const kind = formData.get("kind") as string | null;

  if (!file || !kind) {
    return NextResponse.json({ error: "file and kind (certificate | transcript) are required" }, { status: 400 });
  }
  if (kind !== "certificate" && kind !== "transcript") {
    return NextResponse.json({ error: "kind must be certificate or transcript" }, { status: 400 });
  }

  const ext = path.extname(file.name).toLowerCase();
  if (!ALLOWED.has(ext)) {
    return NextResponse.json({ error: "Only PDF, DOC, or DOCX files are allowed." }, { status: 400 });
  }

  const buf = Buffer.from(await file.arrayBuffer());
  if (buf.length > MAX_BYTES) {
    return NextResponse.json({ error: "File too large (max 8 MB)." }, { status: 400 });
  }

  const dir = path.join(process.cwd(), "public", "uploads", "templates");
  await mkdir(dir, { recursive: true });

  const safeBase = `${kind}-${Date.now()}-${Math.random().toString(36).slice(2, 9)}${ext}`;
  const abs = path.join(dir, safeBase);
  await writeFile(abs, buf);

  const url = `/uploads/templates/${safeBase}`;
  return NextResponse.json({
    url,
    fileName: file.name,
    kind,
  });
}
