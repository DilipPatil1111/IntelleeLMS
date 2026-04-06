import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { hasTeacherPortalAccess } from "@/lib/portal-access";
import { staffCanAccessProgram } from "@/lib/program-content";
import {
  uploadToBlob,
  LESSON_VIDEO_ALLOWED_EXT,
  LESSON_AUDIO_ALLOWED_EXT,
  LESSON_PDF_ALLOWED_EXT,
  LESSON_PRESENTATION_ALLOWED_EXT,
  LESSON_DOWNLOAD_ALLOWED_EXT,
  LESSON_MULTIMEDIA_ALLOWED_EXT,
  LESSON_VIDEO_MAX_BYTES,
  LESSON_AUDIO_MAX_BYTES,
  LESSON_PDF_MAX_BYTES,
  LESSON_PRESENTATION_MAX_BYTES,
  LESSON_DOWNLOAD_MAX_BYTES,
  LESSON_MULTIMEDIA_MAX_BYTES,
} from "@/lib/file-upload";
import { NextResponse } from "next/server";
import type { ProgramLessonKind } from "@/app/generated/prisma/enums";

export const runtime = "nodejs";

function getAllowedConfig(kind: ProgramLessonKind): { ext: Set<string>; maxBytes: number } | null {
  switch (kind) {
    case "VIDEO":        return { ext: LESSON_VIDEO_ALLOWED_EXT,        maxBytes: LESSON_VIDEO_MAX_BYTES };
    case "AUDIO":        return { ext: LESSON_AUDIO_ALLOWED_EXT,        maxBytes: LESSON_AUDIO_MAX_BYTES };
    case "PDF":          return { ext: LESSON_PDF_ALLOWED_EXT,          maxBytes: LESSON_PDF_MAX_BYTES };
    case "PRESENTATION": return { ext: LESSON_PRESENTATION_ALLOWED_EXT, maxBytes: LESSON_PRESENTATION_MAX_BYTES };
    case "DOWNLOAD":     return { ext: LESSON_DOWNLOAD_ALLOWED_EXT,     maxBytes: LESSON_DOWNLOAD_MAX_BYTES };
    case "MULTIMEDIA":   return { ext: LESSON_MULTIMEDIA_ALLOWED_EXT,   maxBytes: LESSON_MULTIMEDIA_MAX_BYTES };
    default:             return null;
  }
}

export async function POST(req: Request, { params }: { params: Promise<{ lessonId: string }> }) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!hasTeacherPortalAccess(session)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { lessonId } = await params;

  const lesson = await db.programLesson.findUnique({
    where: { id: lessonId },
    include: { chapter: { include: { subject: true } } },
  });
  if (!lesson) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const can = await staffCanAccessProgram(session.user.id, "TEACHER", lesson.chapter.subject.programId);
  if (!can) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const config = getAllowedConfig(lesson.kind);
  if (!config) {
    return NextResponse.json({ error: "This lesson type does not support file uploads." }, { status: 400 });
  }

  const formData = await req.formData();
  const file = formData.get("file") as File | null;
  if (!file) return NextResponse.json({ error: "No file provided." }, { status: 400 });

  const buffer = Buffer.from(await file.arrayBuffer());

  const result = await uploadToBlob({
    buffer,
    originalName: file.name,
    allowedExt: config.ext,
    maxBytes: config.maxBytes,
    folder: `lesson-content/${lessonId}`,
  });

  if ("error" in result) return NextResponse.json({ error: result.error }, { status: 400 });

  return NextResponse.json({
    url: result.url,
    name: file.name,
    size: file.size,
  });
}
