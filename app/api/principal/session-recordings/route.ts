import { NextResponse } from "next/server";
import { requirePrincipalPortal } from "@/lib/api-auth";
import { db } from "@/lib/db";
import { uploadToBlob, LESSON_VIDEO_ALLOWED_EXT, LESSON_VIDEO_MAX_BYTES } from "@/lib/file-upload";

export const runtime = "nodejs";

export async function GET(req: Request) {
  const gate = await requirePrincipalPortal();
  if (!gate.ok) return gate.response;

  const { searchParams } = new URL(req.url);
  const programId = searchParams.get("programId");
  if (!programId) return NextResponse.json({ error: "programId is required" }, { status: 400 });

  const recordings = await db.sessionRecording.findMany({
    where: { programId },
    orderBy: { sessionDate: "desc" },
    include: { uploadedBy: { select: { firstName: true, lastName: true } } },
  });

  return NextResponse.json({ recordings });
}

export async function POST(req: Request) {
  const gate = await requirePrincipalPortal();
  if (!gate.ok) return gate.response;

  const formData = await req.formData();
  const file = formData.get("file") as File | null;
  const title = (formData.get("title") as string)?.trim();
  const sessionDate = formData.get("sessionDate") as string;
  const programId = formData.get("programId") as string;
  const durationMin = formData.get("durationMin") as string | null;

  if (!file || !title || !sessionDate || !programId) {
    return NextResponse.json({ error: "file, title, sessionDate, and programId are required" }, { status: 400 });
  }

  const buffer = Buffer.from(await file.arrayBuffer());
  const result = await uploadToBlob({
    buffer,
    originalName: file.name,
    allowedExt: LESSON_VIDEO_ALLOWED_EXT,
    maxBytes: LESSON_VIDEO_MAX_BYTES,
    folder: `session-recordings/${programId}`,
  });

  if ("error" in result) return NextResponse.json({ error: result.error }, { status: 400 });

  const recording = await db.sessionRecording.create({
    data: {
      programId,
      title,
      sessionDate: new Date(sessionDate),
      videoUrl: result.url,
      fileName: file.name,
      durationMin: durationMin ? parseInt(durationMin, 10) : null,
      uploadedById: gate.session.user.id,
    },
  });

  return NextResponse.json({ recording }, { status: 201 });
}
