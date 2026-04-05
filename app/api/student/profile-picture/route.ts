import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { uploadProfilePictureToBlob } from "@/lib/file-upload";
import { NextResponse } from "next/server";

export const runtime = "nodejs";

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const formData = await req.formData();
    const file = formData.get("file") as File | null;

    if (!file) return NextResponse.json({ error: "No file uploaded" }, { status: 400 });

    const buffer = Buffer.from(await file.arrayBuffer());

    const result = await uploadProfilePictureToBlob({
      buffer,
      mimeType: file.type,
      fileName: file.name,
      userId: session.user.id,
    });

    if ("error" in result) {
      return NextResponse.json({ error: result.error }, { status: 400 });
    }

    await db.user.update({
      where: { id: session.user.id },
      data: { profilePicture: result.url },
    });

    return NextResponse.json({ profilePicture: result.url });
  } catch {
    return NextResponse.json({ error: "Failed to upload" }, { status: 500 });
  }
}

export async function DELETE() {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  await db.user.update({
    where: { id: session.user.id },
    data: { profilePicture: null },
  });

  return NextResponse.json({ success: true });
}
