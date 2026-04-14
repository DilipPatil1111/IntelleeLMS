import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { hasTeacherPortalAccess } from "@/lib/portal-access";
import { staffCanAccessProgram } from "@/lib/program-content";
import { NextResponse } from "next/server";

export const runtime = "nodejs";

async function assertAccess(sessionUserId: string, lessonId: string, session: Parameters<typeof staffCanAccessProgram>[1]) {
  const lesson = await db.programLesson.findUnique({
    where: { id: lessonId },
    include: { chapter: { include: { subject: true } } },
  });
  if (!lesson) return { error: "Not found" as const };
  const can = await staffCanAccessProgram(sessionUserId, session, lesson.chapter.subject.programId);
  if (!can) return { error: "Forbidden" as const };
  return { lesson };
}

export async function GET(_req: Request, { params }: { params: Promise<{ lessonId: string }> }) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!hasTeacherPortalAccess(session)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { lessonId } = await params;
  const a = await assertAccess(session.user.id, lessonId, session);
  if ("error" in a && a.error === "Not found") return NextResponse.json({ error: "Not found" }, { status: 404 });
  if ("error" in a) return NextResponse.json({ error: a.error }, { status: 403 });

  const programId = a.lesson.chapter.subject.programId;

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

  const completions = await db.programLessonCompletion.findMany({
    where: { lessonId, studentUserId: { in: allStudents.map((s) => s.id) } },
    select: { studentUserId: true },
  });
  const completedSet = new Set(completions.map((c) => c.studentUserId));

  return NextResponse.json({
    students: allStudents.map((s) => ({ ...s, completed: completedSet.has(s.id) })),
  });
}

export async function POST(req: Request, { params }: { params: Promise<{ lessonId: string }> }) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!hasTeacherPortalAccess(session)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { lessonId } = await params;
  const a = await assertAccess(session.user.id, lessonId, session);
  if ("error" in a && a.error === "Not found") return NextResponse.json({ error: "Not found" }, { status: 404 });
  if ("error" in a) return NextResponse.json({ error: a.error }, { status: 403 });

  if (a.lesson.kind === "QUIZ") {
    return NextResponse.json({ error: "Quiz lessons are completed through Assessments" }, { status: 400 });
  }

  const body = (await req.json()) as { studentUserIds?: string[] };
  const ids = Array.isArray(body.studentUserIds) ? body.studentUserIds.filter(Boolean) : [];
  if (ids.length === 0) return NextResponse.json({ error: "No student IDs provided" }, { status: 400 });

  const results: { studentUserId: string; ok: boolean }[] = [];
  for (const studentUserId of ids) {
    await db.programLessonCompletion.upsert({
      where: { studentUserId_lessonId: { studentUserId, lessonId } },
      create: { studentUserId, lessonId },
      update: {},
    });
    results.push({ studentUserId, ok: true });
  }

  return NextResponse.json({ ok: true, results });
}

export async function DELETE(req: Request, { params }: { params: Promise<{ lessonId: string }> }) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!hasTeacherPortalAccess(session)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { lessonId } = await params;
  const a = await assertAccess(session.user.id, lessonId, session);
  if ("error" in a && a.error === "Not found") return NextResponse.json({ error: "Not found" }, { status: 404 });
  if ("error" in a) return NextResponse.json({ error: a.error }, { status: 403 });

  const body = (await req.json()) as { studentUserIds?: string[] };
  const ids = Array.isArray(body.studentUserIds) ? body.studentUserIds.filter(Boolean) : [];
  if (ids.length === 0) return NextResponse.json({ error: "No student IDs provided" }, { status: 400 });

  await db.programLessonCompletion.deleteMany({
    where: { lessonId, studentUserId: { in: ids } },
  });

  return NextResponse.json({ ok: true });
}
