import { requireStudentPortal } from "@/lib/api-auth";
import { db } from "@/lib/db";
import { uploadProfilePictureToBlob } from "@/lib/file-upload";
import { NextResponse } from "next/server";

export const runtime = "nodejs";

export async function POST(req: Request) {
  const gate = await requireStudentPortal();
  if (!gate.ok) return gate.response;
  const session = gate.session;

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
  const gate2 = await requireStudentPortal();
  if (!gate2.ok) return gate2.response;
  const session = gate2.session;

  await db.user.update({
    where: { id: session.user.id },
    data: { profilePicture: null },
  });

  return NextResponse.json({ success: true });
}
