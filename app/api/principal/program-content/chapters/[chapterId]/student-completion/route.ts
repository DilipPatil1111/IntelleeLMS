import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { hasPrincipalPortalAccess } from "@/lib/portal-access";
import { staffCanAccessProgram } from "@/lib/program-content";
import { NextResponse } from "next/server";

export const runtime = "nodejs";

async function assertAccess(sessionUserId: string, chapterId: string) {
  const chapter = await db.programChapter.findUnique({
    where: { id: chapterId },
    include: { subject: true },
  });
  if (!chapter) return { error: "Not found" as const };
  const can = await staffCanAccessProgram(sessionUserId, "PRINCIPAL", chapter.subject.programId);
  if (!can) return { error: "Forbidden" as const };
  return { chapter };
}

export async function GET(_req: Request, { params }: { params: Promise<{ chapterId: string }> }) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!hasPrincipalPortalAccess(session)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { chapterId } = await params;
  const a = await assertAccess(session.user.id, chapterId);
  if ("error" in a && a.error === "Not found") return NextResponse.json({ error: "Not found" }, { status: 404 });
  if ("error" in a) return NextResponse.json({ error: a.error }, { status: 403 });

  const programId = a.chapter.subject.programId;

  const lessons = await db.programLesson.findMany({
    where: { chapterId, isDraft: false, kind: { not: "QUIZ" } },
    select: { id: true },
  });
  const lessonIds = lessons.map((l) => l.id);

  const profiles = await db.studentProfile.findMany({
    where: { programId, status: { in: ["ENROLLED", "COMPLETED", "GRADUATED"] } },
    include: { user: { select: { id: true, firstName: true, lastName: true } } },
    orderBy: { enrollmentNo: "asc" },
  });
  const enrollments = await db.programEnrollment.findMany({
    where: { programId, status: { in: ["ENROLLED", "COMPLETED", "GRADUATED"] } },
    include: { user: { select: { id: true, firstName: true, lastName: true } } },
  });

  const seen = new Set<string>();
  const allStudents: { id: string; name: string }[] = [];
  for (const p of profiles) {
    if (!seen.has(p.userId)) {
      seen.add(p.userId);
      allStudents.push({ id: p.userId, name: `${p.user.firstName} ${p.user.lastName}`.trim() });
    }
  }
  for (const e of enrollments) {
    if (!seen.has(e.userId)) {
      seen.add(e.userId);
      allStudents.push({ id: e.userId, name: `${e.user.firstName} ${e.user.lastName}`.trim() });
    }
  }

  const completions = lessonIds.length > 0
    ? await db.programLessonCompletion.findMany({
        where: { lessonId: { in: lessonIds }, studentUserId: { in: allStudents.map((s) => s.id) } },
        select: { studentUserId: true, lessonId: true },
      })
    : [];

  const completionMap = new Map<string, Set<string>>();
  for (const c of completions) {
    if (!completionMap.has(c.studentUserId)) completionMap.set(c.studentUserId, new Set());
    completionMap.get(c.studentUserId)!.add(c.lessonId);
  }

  return NextResponse.json({
    lessonCount: lessonIds.length,
    students: allStudents.map((s) => ({
      ...s,
      completed: (completionMap.get(s.id)?.size ?? 0) >= lessonIds.length && lessonIds.length > 0,
      completedLessons: completionMap.get(s.id)?.size ?? 0,
    })),
  });
}

export async function POST(req: Request, { params }: { params: Promise<{ chapterId: string }> }) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!hasPrincipalPortalAccess(session)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { chapterId } = await params;
  const a = await assertAccess(session.user.id, chapterId);
  if ("error" in a && a.error === "Not found") return NextResponse.json({ error: "Not found" }, { status: 404 });
  if ("error" in a) return NextResponse.json({ error: a.error }, { status: 403 });

  const body = (await req.json()) as { studentUserIds?: string[] };
  const ids = Array.isArray(body.studentUserIds) ? body.studentUserIds.filter(Boolean) : [];
  if (ids.length === 0) return NextResponse.json({ error: "No student IDs provided" }, { status: 400 });

  const lessons = await db.programLesson.findMany({
    where: { chapterId, isDraft: false, kind: { not: "QUIZ" } },
    select: { id: true },
  });

  for (const studentUserId of ids) {
    for (const lesson of lessons) {
      await db.programLessonCompletion.upsert({
        where: { studentUserId_lessonId: { studentUserId, lessonId: lesson.id } },
        create: { studentUserId, lessonId: lesson.id },
        update: {},
      });
    }
  }

  return NextResponse.json({ ok: true, lessonsMarked: lessons.length, studentsMarked: ids.length });
}

export async function DELETE(req: Request, { params }: { params: Promise<{ chapterId: string }> }) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!hasPrincipalPortalAccess(session)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { chapterId } = await params;
  const a = await assertAccess(session.user.id, chapterId);
  if ("error" in a && a.error === "Not found") return NextResponse.json({ error: "Not found" }, { status: 404 });
  if ("error" in a) return NextResponse.json({ error: a.error }, { status: 403 });

  const body = (await req.json()) as { studentUserIds?: string[] };
  const ids = Array.isArray(body.studentUserIds) ? body.studentUserIds.filter(Boolean) : [];
  if (ids.length === 0) return NextResponse.json({ error: "No student IDs provided" }, { status: 400 });

  const lessons = await db.programLesson.findMany({
    where: { chapterId, isDraft: false, kind: { not: "QUIZ" } },
    select: { id: true },
  });

  await db.programLessonCompletion.deleteMany({
    where: {
      lessonId: { in: lessons.map((l) => l.id) },
      studentUserId: { in: ids },
    },
  });

  return NextResponse.json({ ok: true });
}
