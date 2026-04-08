import { auth } from "@/lib/auth";
import { hasPrincipalPortalAccess } from "@/lib/portal-access";
import { uploadToBlob } from "@/lib/file-upload";
import { NextResponse } from "next/server";

const CERT_BG_ALLOWED_EXT = new Set([".pdf", ".png", ".jpg", ".jpeg", ".webp"]);
const CERT_BG_MAX_BYTES = 20 * 1024 * 1024;

export const runtime = "nodejs";

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!hasPrincipalPortalAccess(session)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const formData = await req.formData();
  const file = formData.get("file") as File | null;
  if (!file) return NextResponse.json({ error: "No file provided" }, { status: 400 });

  const buffer = Buffer.from(await file.arrayBuffer());
  const result = await uploadToBlob({
    buffer,
    originalName: file.name,
    allowedExt: CERT_BG_ALLOWED_EXT,
    maxBytes: CERT_BG_MAX_BYTES,
    folder: "certificate-templates",
  });

  if ("error" in result) {
    return NextResponse.json({ error: result.error }, { status: 400 });
  }

  return NextResponse.json({ url: result.url, fileName: result.storedFileName });
}
