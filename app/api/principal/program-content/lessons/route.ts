import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { hasPrincipalPortalAccess } from "@/lib/portal-access";
import { staffCanAccessProgram } from "@/lib/program-content";
import type { ProgramLessonKind } from "@/app/generated/prisma/enums";
import { NextResponse } from "next/server";

export const runtime = "nodejs";

const KINDS: ProgramLessonKind[] = [
  "TEXT",
  "VIDEO",
  "PDF",
  "AUDIO",
  "PRESENTATION",
  "QUIZ",
  "DOWNLOAD",
  "SURVEY",
  "MULTIMEDIA",
];

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!hasPrincipalPortalAccess(session)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const body = (await req.json()) as {
    chapterId: string;
    kind: ProgramLessonKind;
    title: string;
    content?: unknown;
    assessmentId?: string | null;
    isDraft?: boolean;
    sortOrder?: number;
  };

  if (!body.chapterId || !body.title?.trim() || !body.kind) {
    return NextResponse.json({ error: "chapterId, kind, title required" }, { status: 400 });
  }
  if (!KINDS.includes(body.kind)) {
    return NextResponse.json({ error: "Invalid kind" }, { status: 400 });
  }

  const chapter = await db.programChapter.findUnique({
    where: { id: body.chapterId },
    include: { subject: true },
  });
  if (!chapter) return NextResponse.json({ error: "Chapter not found" }, { status: 404 });

  const can = await staffCanAccessProgram(session.user.id, "PRINCIPAL", chapter.subject.programId);
  if (!can) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  if (body.assessmentId) {
    const asmt = await db.assessment.findUnique({
      where: { id: body.assessmentId },
      include: { subject: true },
    });
    if (!asmt || asmt.subject.programId !== chapter.subject.programId) {
      return NextResponse.json({ error: "Assessment must belong to the same program" }, { status: 400 });
    }
  }

  const maxOrder = await db.programLesson.aggregate({
    where: { chapterId: body.chapterId },
    _max: { sortOrder: true },
  });
  const sortOrder = body.sortOrder ?? (maxOrder._max.sortOrder ?? -1) + 1;

  const lesson = await db.programLesson.create({
    data: {
      chapterId: body.chapterId,
      kind: body.kind,
      title: body.title.trim(),
      sortOrder,
      content: body.content === undefined ? undefined : (body.content as object),
      assessmentId: body.assessmentId ?? null,
      isDraft: body.isDraft ?? true,
    },
  });

  return NextResponse.json({ lesson });
}
