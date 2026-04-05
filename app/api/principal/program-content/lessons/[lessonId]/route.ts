import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { hasPrincipalPortalAccess } from "@/lib/portal-access";
import { staffCanAccessProgram } from "@/lib/program-content";
import type { ProgramLessonKind } from "@/app/generated/prisma/enums";
import { NextResponse } from "next/server";

export const runtime = "nodejs";

async function assertLessonAccess(sessionUserId: string, lessonId: string) {
  const lesson = await db.programLesson.findUnique({
    where: { id: lessonId },
    include: { chapter: { include: { subject: true } } },
  });
  if (!lesson) return { error: "Not found" as const };
  const can = await staffCanAccessProgram(sessionUserId, "PRINCIPAL", lesson.chapter.subject.programId);
  if (!can) return { error: "Forbidden" as const };
  return { lesson };
}

export async function PATCH(req: Request, { params }: { params: Promise<{ lessonId: string }> }) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!hasPrincipalPortalAccess(session)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { lessonId } = await params;
  const a = await assertLessonAccess(session.user.id, lessonId);
  if ("error" in a && a.error === "Not found") return NextResponse.json({ error: "Not found" }, { status: 404 });
  if ("error" in a) return NextResponse.json({ error: a.error }, { status: 403 });

  const body = (await req.json()) as {
    title?: string;
    kind?: ProgramLessonKind;
    content?: unknown;
    assessmentId?: string | null;
    isDraft?: boolean;
    sortOrder?: number;
  };

  if (body.assessmentId) {
    const asmt = await db.assessment.findUnique({
      where: { id: body.assessmentId },
      include: { subject: true },
    });
    const programId = a.lesson.chapter.subject.programId;
    if (!asmt || asmt.subject.programId !== programId) {
      return NextResponse.json({ error: "Assessment must belong to the same program" }, { status: 400 });
    }
  }

  const lesson = await db.programLesson.update({
    where: { id: lessonId },
    data: {
      title: body.title?.trim(),
      kind: body.kind,
      content: body.content === undefined ? undefined : (body.content as object),
      assessmentId: body.assessmentId === undefined ? undefined : body.assessmentId,
      isDraft: body.isDraft,
      sortOrder: body.sortOrder,
    },
  });

  return NextResponse.json({ lesson });
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ lessonId: string }> }) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!hasPrincipalPortalAccess(session)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { lessonId } = await params;
  const a = await assertLessonAccess(session.user.id, lessonId);
  if ("error" in a && a.error === "Not found") return NextResponse.json({ error: "Not found" }, { status: 404 });
  if ("error" in a) return NextResponse.json({ error: a.error }, { status: 403 });

  await db.programLesson.delete({ where: { id: lessonId } });
  return NextResponse.json({ ok: true });
}
