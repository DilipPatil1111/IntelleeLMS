import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { uploadProfilePictureToBlob } from "@/lib/file-upload";
import { NextResponse } from "next/server";

export const runtime = "nodejs";

/** POST /api/user/profile-picture — upload a profile photo for any authenticated user */
export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

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
  } catch (e) {
    console.error("POST /api/user/profile-picture", e);
    const msg = e instanceof Error ? e.message : "Upload failed";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

/** DELETE /api/user/profile-picture — remove profile photo for any authenticated user */
export async function DELETE() {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  await db.user.update({
    where: { id: session.user.id },
    data: { profilePicture: null },
  });

  return NextResponse.json({ success: true });
}
