import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { hasTeacherPortalAccess } from "@/lib/portal-access";
import { staffCanAccessProgram } from "@/lib/program-content";
import { NextResponse } from "next/server";

export const runtime = "nodejs";

async function assertChapterAccess(sessionUserId: string, chapterId: string, session: Parameters<typeof staffCanAccessProgram>[1]) {
  const ch = await db.programChapter.findUnique({
    where: { id: chapterId },
    include: { subject: true },
  });
  if (!ch) return { error: "Not found" as const };
  const can = await staffCanAccessProgram(sessionUserId, session, ch.subject.programId);
  if (!can) return { error: "Forbidden" as const };
  return { chapter: ch };
}

export async function PATCH(req: Request, { params }: { params: Promise<{ chapterId: string }> }) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!hasTeacherPortalAccess(session)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { chapterId } = await params;
  const a = await assertChapterAccess(session.user.id, chapterId, session);
  if ("error" in a && a.error === "Not found") return NextResponse.json({ error: "Not found" }, { status: 404 });
  if ("error" in a) return NextResponse.json({ error: a.error }, { status: 403 });

  const body = (await req.json()) as {
    title?: string;
    sortOrder?: number;
    isMandatory?: boolean;
    freePreviewLesson?: boolean;
    isPrerequisite?: boolean;
    enableDiscussions?: boolean;
  };

  const chapter = await db.programChapter.update({
    where: { id: chapterId },
    data: {
      title: body.title?.trim(),
      sortOrder: body.sortOrder,
      isMandatory: body.isMandatory,
      freePreviewLesson: body.freePreviewLesson,
      isPrerequisite: body.isPrerequisite,
      enableDiscussions: body.enableDiscussions,
    },
  });

  return NextResponse.json({ chapter });
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ chapterId: string }> }) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!hasTeacherPortalAccess(session)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { chapterId } = await params;
  const a = await assertChapterAccess(session.user.id, chapterId, session);
  if ("error" in a && a.error === "Not found") return NextResponse.json({ error: "Not found" }, { status: 404 });
  if ("error" in a) return NextResponse.json({ error: a.error }, { status: 403 });

  await db.programChapter.delete({ where: { id: chapterId } });
  return NextResponse.json({ ok: true });
}
