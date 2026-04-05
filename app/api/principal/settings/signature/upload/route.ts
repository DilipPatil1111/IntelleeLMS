import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { NextResponse } from "next/server";
import { blobPut } from "@/lib/vercel-blob";
import { randomUUID } from "crypto";

/** POST /api/principal/settings/signature/upload — upload a signature image */
export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const form = await req.formData().catch(() => null);
  if (!form) {
    return NextResponse.json({ error: "Expected multipart/form-data" }, { status: 400 });
  }

  const file = form.get("file");
  if (!file || typeof file === "string") {
    return NextResponse.json({ error: "file field is required" }, { status: 400 });
  }

  const allowedTypes = ["image/png", "image/jpeg", "image/jpg", "image/gif", "image/webp", "image/svg+xml"];
  if (!allowedTypes.includes(file.type)) {
    return NextResponse.json(
      { error: "Only image files are accepted (png, jpg, gif, webp, svg)" },
      { status: 400 },
    );
  }

  const ext = file.name.split(".").pop() ?? "png";
  const blob = await blobPut(
    `signatures/${session.user.id}-${randomUUID()}.${ext}`,
    file,
    { contentType: file.type, access: "public" }, // must be public so email clients can display it
  );

  // Persist URL on user immediately
  await db.user.update({
    where: { id: session.user.id },
    data: { signatureImageUrl: blob.url },
  });

  return NextResponse.json({ url: blob.url });
}
