import { auth } from "@/lib/auth";
import {
  TEMPLATE_ALLOWED_EXT,
  TEMPLATE_MAX_BYTES,
  writePublicUpload,
} from "@/lib/file-upload";
import { NextResponse } from "next/server";

export const runtime = "nodejs";

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const role = (session.user as unknown as Record<string, unknown>).role as string;
  if (role !== "PRINCIPAL") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  let formData: FormData;
  try {
    formData = await req.formData();
  } catch {
    return NextResponse.json({ error: "Invalid form data." }, { status: 400 });
  }

  const file = formData.get("file") as File | null;
  const kind = formData.get("kind") as string | null;

  if (!file || !kind) {
    return NextResponse.json({ error: "Missing file or kind." }, { status: 400 });
  }

  const allowedKinds = ["certificate", "transcript", "studentContract"] as const;
  if (!allowedKinds.includes(kind as (typeof allowedKinds)[number])) {
    return NextResponse.json(
      { error: "kind must be certificate, transcript, or studentContract." },
      { status: 400 }
    );
  }

  const buf = Buffer.from(await file.arrayBuffer());
  const result = await writePublicUpload({
    buffer: buf,
    originalName: file.name || "upload.bin",
    allowedExt: TEMPLATE_ALLOWED_EXT,
    maxBytes: TEMPLATE_MAX_BYTES,
    publicSubdir: "templates",
  });

  if ("error" in result) {
    return NextResponse.json({ error: result.error, uploaded: false }, { status: 500 });
  }

  return NextResponse.json({
    url: result.url,
    fileName: file.name,
    kind,
    uploaded: true,
    message: "File uploaded successfully.",
  });
}
