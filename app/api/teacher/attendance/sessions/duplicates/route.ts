import { requireTeacherPortal } from "@/lib/api-auth";
import { db } from "@/lib/db";
import { NextResponse } from "next/server";

export const runtime = "nodejs";

export type DuplicateSessionItem = {
  id: string;
  subjectName: string;
  batchName: string;
  programName: string;
  sessionDate: string;
  startTime: string | null;
  endTime: string | null;
  recordCount: number;
  createdAt: string;
  suggested: boolean;
};

export type DuplicateGroup = {
  key: string;
  subjectName: string;
  programName: string;
  batchName: string;
  sessionDate: string;
  startTime: string | null;
  endTime: string | null;
  sessions: DuplicateSessionItem[];
};

/**
 * GET  — returns duplicate session groups created by this teacher.
 * DELETE — bulk-deletes the supplied session IDs.
 */

export async function GET(req: Request) {
  const gate = await requireTeacherPortal();
  if (!gate.ok) return gate.response;
  const authSession = gate.session;

  const { searchParams } = new URL(req.url);
  const subjectId = searchParams.get("subjectId") || undefined;
  const batchId = searchParams.get("batchId") || undefined;

  const allSessions = await db.attendanceSession.findMany({
    where: {
      createdById: authSession.user.id,
      ...(subjectId ? { subjectId } : {}),
      ...(batchId ? { batchId } : {}),
    },
    select: {
      id: true,
      subjectId: true,
      batchId: true,
      sessionDate: true,
      startTime: true,
      endTime: true,
      createdAt: true,
      subject: { select: { name: true } },
      batch: { select: { name: true, program: { select: { name: true } } } },
      _count: { select: { records: true } },
    },
    orderBy: { createdAt: "asc" },
  });

  const groups = new Map<string, typeof allSessions>();
  for (const s of allSessions) {
    const dateStr = s.sessionDate.toISOString().substring(0, 10);
    const key = `${s.subjectId}|${s.batchId}|${dateStr}|${s.startTime ?? ""}|${s.endTime ?? ""}`;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key)!.push(s);
  }

  const duplicateGroups: DuplicateGroup[] = [];

  for (const [key, sessions] of groups) {
    if (sessions.length <= 1) continue;

    let best = sessions[0];
    for (const s of sessions) {
      if (s._count.records > best._count.records) best = s;
    }

    const first = sessions[0];
    duplicateGroups.push({
      key,
      subjectName: first.subject.name,
      programName: first.batch.program.name,
      batchName: first.batch.name,
      sessionDate: first.sessionDate.toISOString().substring(0, 10),
      startTime: first.startTime,
      endTime: first.endTime,
      sessions: sessions.map((s) => ({
        id: s.id,
        subjectName: s.subject.name,
        batchName: s.batch.name,
        programName: s.batch.program.name,
        sessionDate: s.sessionDate.toISOString().substring(0, 10),
        startTime: s.startTime,
        endTime: s.endTime,
        recordCount: s._count.records,
        createdAt: s.createdAt.toISOString(),
        suggested: s.id === best.id,
      })),
    });
  }

  return NextResponse.json({
    duplicateGroups,
    total: duplicateGroups.length,
    totalExtra: duplicateGroups.reduce((acc, g) => acc + g.sessions.length - 1, 0),
  });
}

export async function DELETE(req: Request) {
  const gate = await requireTeacherPortal();
  if (!gate.ok) return gate.response;

  const body = await req.json().catch(() => ({})) as { sessionIds?: string[] };
  const { sessionIds } = body;

  if (!Array.isArray(sessionIds) || sessionIds.length === 0) {
    return NextResponse.json({ error: "sessionIds array is required" }, { status: 400 });
  }

  const { count } = await db.attendanceSession.deleteMany({
    where: {
      id: { in: sessionIds },
      createdById: gate.session.user.id,
    },
  });

  return NextResponse.json({ deleted: count });
}
