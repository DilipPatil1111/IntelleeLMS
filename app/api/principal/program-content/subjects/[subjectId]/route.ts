import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { hasPrincipalPortalAccess } from "@/lib/portal-access";
import { staffCanAccessProgram } from "@/lib/program-content";
import { NextResponse } from "next/server";

export const runtime = "nodejs";

/** PATCH — edit subject name/code */
export async function PATCH(req: Request, { params }: { params: Promise<{ subjectId: string }> }) {
  const { subjectId } = await params;
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!hasPrincipalPortalAccess(session)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const subject = await db.subject.findUnique({ where: { id: subjectId } });
  if (!subject) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const can = await staffCanAccessProgram(session.user.id, "PRINCIPAL", subject.programId);
  if (!can) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const body = (await req.json()) as { name?: string; code?: string };
  try {
    const updated = await db.subject.update({
      where: { id: subjectId },
      data: {
        ...(body.name?.trim() && { name: body.name.trim() }),
        ...(body.code?.trim() && { code: body.code.trim().toUpperCase() }),
      },
    });
    return NextResponse.json({ subject: updated });
  } catch {
    return NextResponse.json({ error: "Subject code already exists" }, { status: 409 });
  }
}

/** DELETE — only allowed when syllabus is NOT published */
export async function DELETE(_req: Request, { params }: { params: Promise<{ subjectId: string }> }) {
  const { subjectId } = await params;
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!hasPrincipalPortalAccess(session)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const subject = await db.subject.findUnique({ where: { id: subjectId } });
  if (!subject) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const can = await staffCanAccessProgram(session.user.id, "PRINCIPAL", subject.programId);
  if (!can) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  // Block delete if syllabus is published
  const syllabus = await db.programSyllabus.findUnique({ where: { programId: subject.programId } });
  if (syllabus?.isPublished) {
    return NextResponse.json(
      { error: "Cannot delete a subject from a published program. Unpublish the program first, or request approval.", published: true },
      { status: 409 }
    );
  }

  // Cascade delete chapters and lessons belonging to this subject
  const chapters = await db.programChapter.findMany({ where: { subjectId }, select: { id: true } });
  const chapterIds = chapters.map((c) => c.id);
  await db.programLessonCompletion.deleteMany({ where: { lesson: { chapterId: { in: chapterIds } } } });
  await db.programLesson.deleteMany({ where: { chapterId: { in: chapterIds } } });
  await db.programChapter.deleteMany({ where: { subjectId } });
  await db.subject.delete({ where: { id: subjectId } });

  return NextResponse.json({ ok: true });
}
