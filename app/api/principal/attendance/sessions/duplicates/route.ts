import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { hasPrincipalPortalAccess } from "@/lib/portal-access";
import { NextResponse } from "next/server";

export const runtime = "nodejs";

export type DuplicateSessionItem = {
  id: string;
  subjectId: string;
  subjectName: string;
  batchId: string;
  batchName: string;
  programName: string;
  sessionDate: string;
  startTime: string | null;
  endTime: string | null;
  recordCount: number;
  createdAt: string;
  /** Suggested session to keep (has most student records; oldest if tied). */
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
 * GET  — returns groups of duplicate sessions (same subject + batch + date +
 *         startTime + endTime) for the principal to review.
 * DELETE — bulk-deletes the supplied session IDs (extras only).
 */

export async function GET(req: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!hasPrincipalPortalAccess(session)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { searchParams } = new URL(req.url);
  const programId = searchParams.get("programId") || undefined;
  const batchId = searchParams.get("batchId") || undefined;

  const allSessions = await db.attendanceSession.findMany({
    where: {
      ...(batchId ? { batchId } : {}),
      ...(programId ? { batch: { programId } } : {}),
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

  // Group by subject + batch + date (YYYY-MM-DD) + startTime + endTime
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

    // Pick "suggested keep" = session with most student records; oldest if tied
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
        subjectId: s.subjectId,
        subjectName: s.subject.name,
        batchId: s.batchId,
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
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!hasPrincipalPortalAccess(session)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await req.json().catch(() => ({})) as { sessionIds?: string[] };
  const { sessionIds } = body;

  if (!Array.isArray(sessionIds) || sessionIds.length === 0) {
    return NextResponse.json({ error: "sessionIds array is required" }, { status: 400 });
  }

  const { count } = await db.attendanceSession.deleteMany({
    where: { id: { in: sessionIds } },
  });

  return NextResponse.json({ deleted: count });
}
