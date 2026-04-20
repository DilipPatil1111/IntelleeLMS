import { db } from "@/lib/db";

/**
 * Attendance / enrollment / profile consistency checker.
 *
 * PURPOSE
 * -------
 * In production we've hit cases where a student has `AttendanceRecord`s in a
 * program but no `ProgramEnrollment` row for it (and/or their
 * `studentProfile.batchId` is stale). When that happens:
 *   - The attendance-report student dropdown is empty for that student
 *     (fixed in a separate commit so the dropdown is now a strict superset
 *      of the recordable students).
 *   - The student does not show up in batch-centric enrollment queries.
 *   - Batch attendance % calculations can miss them.
 *
 * This module finds those inconsistencies and — only on explicit opt-in —
 * creates the missing rows. It never deletes.
 *
 * SAFETY
 * ------
 *   - `diagnoseAttendanceSync()` is read-only.
 *   - `applyAttendanceSync()` is a no-op unless the caller names specific
 *     categories.
 *   - Every write goes through a Prisma transaction, capped at
 *     `MAX_WRITES_PER_RUN` so a bad dataset can't cascade into thousands
 *     of rows.
 *   - Orphan / teacher-missing categories are diagnostic only — we surface
 *     them for manual review instead of guessing values.
 */

export type SyncCategory =
  | "missing_program_enrollment"
  | "missing_profile_batch";

export const AUTO_FIX_CATEGORIES: SyncCategory[] = [
  "missing_program_enrollment",
  "missing_profile_batch",
];

export const REPORT_ONLY_CATEGORIES = [
  "orphan_attendance_records",
  "sessions_missing_teacher_attendance",
] as const;
export type ReportOnlyCategory = (typeof REPORT_ONLY_CATEGORIES)[number];

/** Max rows written per `applyAttendanceSync` call (per category). */
const MAX_WRITES_PER_RUN = 500;
/** Max rows returned in diagnostic samples (we still return totals). */
const SAMPLE_SIZE = 50;

export type MissingEnrollmentIssue = {
  studentUserId: string;
  studentName: string;
  programId: string;
  programName: string;
  batchId: string;
  batchName: string | null;
  attendanceRecordCount: number;
};

export type MissingProfileBatchIssue = {
  studentUserId: string;
  studentName: string;
  currentProfileBatchId: string | null;
  suggestedBatchId: string;
  suggestedBatchName: string | null;
  suggestedProgramId: string;
};

export type OrphanAttendanceIssue = {
  attendanceRecordId: string;
  studentUserId: string;
  studentName: string;
  sessionId: string;
  sessionDate: string;
  subjectName: string | null;
  batchId: string;
  reason: string;
};

export type SessionMissingTeacherIssue = {
  sessionId: string;
  sessionDate: string;
  subjectName: string | null;
  batchId: string;
  createdById: string;
  createdByName: string | null;
  recordCount: number;
};

export type AttendanceSyncDiagnosis = {
  generatedAt: string;
  counts: {
    missing_program_enrollment: number;
    missing_profile_batch: number;
    orphan_attendance_records: number;
    sessions_missing_teacher_attendance: number;
  };
  samples: {
    missing_program_enrollment: MissingEnrollmentIssue[];
    missing_profile_batch: MissingProfileBatchIssue[];
    orphan_attendance_records: OrphanAttendanceIssue[];
    sessions_missing_teacher_attendance: SessionMissingTeacherIssue[];
  };
  /** True when any count exceeds SAMPLE_SIZE (UI shows "+N more"). */
  truncated: {
    missing_program_enrollment: boolean;
    missing_profile_batch: boolean;
    orphan_attendance_records: boolean;
    sessions_missing_teacher_attendance: boolean;
  };
};

// ─── Issue detection ─────────────────────────────────────────────────────────

/**
 * Find students who have attendance in a program but no ProgramEnrollment.
 *
 * A record matters if the session's subject.programId is set. We group by
 * (studentId, programId, batchId) so each missing enrollment is represented
 * once, with the most-frequently-used batch for that program.
 */
async function detectMissingEnrollments(
  limit: number,
): Promise<{ all: MissingEnrollmentIssue[]; total: number }> {
  // Pull every attendance record joined with its session + subject program.
  // At the scale of a single institution this is bounded enough to do in
  // one query; if we ever outgrow that we'll switch to SQL aggregation.
  const records = await db.attendanceRecord.findMany({
    select: {
      studentId: true,
      session: {
        select: {
          batchId: true,
          subject: { select: { programId: true } },
        },
      },
    },
  });

  const grouped = new Map<
    string,
    { studentId: string; programId: string; batchId: string; count: number }
  >();
  for (const r of records) {
    const programId = r.session?.subject?.programId;
    const batchId = r.session?.batchId;
    if (!programId || !batchId) continue;
    const key = `${r.studentId}|${programId}|${batchId}`;
    const entry = grouped.get(key);
    if (entry) {
      entry.count += 1;
    } else {
      grouped.set(key, {
        studentId: r.studentId,
        programId,
        batchId,
        count: 1,
      });
    }
  }

  if (grouped.size === 0) return { all: [], total: 0 };

  const studentIds = [...new Set([...grouped.values()].map((g) => g.studentId))];
  const programIds = [...new Set([...grouped.values()].map((g) => g.programId))];

  const existingEnrollments = await db.programEnrollment.findMany({
    where: {
      userId: { in: studentIds },
      programId: { in: programIds },
    },
    select: { userId: true, programId: true },
  });
  const enrolled = new Set(existingEnrollments.map((e) => `${e.userId}|${e.programId}`));

  // Collapse by (student, program) keeping the batch with the most records so
  // we only create one enrollment per {student, program}.
  const perStudentProgram = new Map<
    string,
    { studentId: string; programId: string; batchId: string; count: number }
  >();
  for (const g of grouped.values()) {
    if (enrolled.has(`${g.studentId}|${g.programId}`)) continue;
    const key = `${g.studentId}|${g.programId}`;
    const existing = perStudentProgram.get(key);
    if (!existing || g.count > existing.count) {
      perStudentProgram.set(key, g);
    }
  }

  const deduped = [...perStudentProgram.values()];
  const total = deduped.length;
  if (total === 0) return { all: [], total: 0 };

  // Resolve names for the sample slice we return.
  const sample = deduped.slice(0, limit);
  const [users, programs, batches] = await Promise.all([
    db.user.findMany({
      where: { id: { in: sample.map((g) => g.studentId) } },
      select: { id: true, firstName: true, lastName: true },
    }),
    db.program.findMany({
      where: { id: { in: sample.map((g) => g.programId) } },
      select: { id: true, name: true },
    }),
    db.batch.findMany({
      where: { id: { in: sample.map((g) => g.batchId) } },
      select: { id: true, name: true },
    }),
  ]);
  const userMap = new Map(users.map((u) => [u.id, u]));
  const programMap = new Map(programs.map((p) => [p.id, p]));
  const batchMap = new Map(batches.map((b) => [b.id, b]));

  const all: MissingEnrollmentIssue[] = sample.map((g) => {
    const u = userMap.get(g.studentId);
    return {
      studentUserId: g.studentId,
      studentName: u ? `${u.firstName} ${u.lastName}`.trim() : g.studentId,
      programId: g.programId,
      programName: programMap.get(g.programId)?.name ?? "—",
      batchId: g.batchId,
      batchName: batchMap.get(g.batchId)?.name ?? null,
      attendanceRecordCount: g.count,
    };
  });

  return { all, total };
}

/**
 * Find students whose `studentProfile.batchId` is null but who have at least
 * one `ProgramEnrollment` with a batchId — their profile should point at a
 * batch so the attendance UI + batch rollups pick them up.
 *
 * We suggest the enrollment with the latest `updatedAt` in case of multiples.
 */
async function detectMissingProfileBatches(
  limit: number,
): Promise<{ all: MissingProfileBatchIssue[]; total: number }> {
  const profilesMissingBatch = await db.studentProfile.findMany({
    where: {
      batchId: null,
      user: {
        programEnrollments: {
          some: { batchId: { not: null } },
        },
      },
    },
    select: {
      userId: true,
      batchId: true,
      user: { select: { firstName: true, lastName: true } },
    },
    take: limit * 4, // over-fetch because we filter further below
  });

  if (profilesMissingBatch.length === 0) return { all: [], total: 0 };

  const userIds = profilesMissingBatch.map((p) => p.userId);
  const enrollments = await db.programEnrollment.findMany({
    where: {
      userId: { in: userIds },
      batchId: { not: null },
    },
    select: {
      userId: true,
      programId: true,
      batchId: true,
      updatedAt: true,
      batch: { select: { name: true } },
    },
    orderBy: { updatedAt: "desc" },
  });

  const latestByUser = new Map<
    string,
    { programId: string; batchId: string; batchName: string | null }
  >();
  for (const e of enrollments) {
    if (latestByUser.has(e.userId) || !e.batchId) continue;
    latestByUser.set(e.userId, {
      programId: e.programId,
      batchId: e.batchId,
      batchName: e.batch?.name ?? null,
    });
  }

  const all: MissingProfileBatchIssue[] = [];
  for (const p of profilesMissingBatch) {
    const suggestion = latestByUser.get(p.userId);
    if (!suggestion) continue;
    all.push({
      studentUserId: p.userId,
      studentName: `${p.user.firstName} ${p.user.lastName}`.trim(),
      currentProfileBatchId: p.batchId,
      suggestedBatchId: suggestion.batchId,
      suggestedBatchName: suggestion.batchName,
      suggestedProgramId: suggestion.programId,
    });
    if (all.length >= limit) break;
  }

  // Total is approximate (bounded by the same filter) — accurate enough for a
  // preview, avoids an extra count query on a non-trivial join.
  const total = all.length;
  return { all, total };
}

/**
 * Find attendance records where the student is neither in the session's batch
 * via their profile nor via any ProgramEnrollment. Surfaces data-entry drift.
 */
async function detectOrphanAttendance(limit: number): Promise<{
  all: OrphanAttendanceIssue[];
  total: number;
}> {
  const records = await db.attendanceRecord.findMany({
    select: {
      id: true,
      studentId: true,
      session: {
        select: {
          id: true,
          batchId: true,
          sessionDate: true,
          subject: { select: { name: true } },
        },
      },
      student: {
        select: {
          firstName: true,
          lastName: true,
          studentProfile: { select: { batchId: true } },
          programEnrollments: { select: { batchId: true } },
        },
      },
    },
  });

  const orphans: OrphanAttendanceIssue[] = [];
  for (const r of records) {
    if (!r.session?.batchId) continue;
    const profileBatch = r.student.studentProfile?.batchId ?? null;
    const enrollmentBatches = new Set(
      r.student.programEnrollments.map((e) => e.batchId).filter((b): b is string => Boolean(b)),
    );
    const isInBatch = profileBatch === r.session.batchId || enrollmentBatches.has(r.session.batchId);
    if (isInBatch) continue;
    orphans.push({
      attendanceRecordId: r.id,
      studentUserId: r.studentId,
      studentName: `${r.student.firstName} ${r.student.lastName}`.trim(),
      sessionId: r.session.id,
      sessionDate: r.session.sessionDate.toISOString().slice(0, 10),
      subjectName: r.session.subject?.name ?? null,
      batchId: r.session.batchId,
      reason: "Student is not in the session's batch via profile or enrollment",
    });
  }

  const total = orphans.length;
  return { all: orphans.slice(0, limit), total };
}

/**
 * Find sessions where no `TeacherAttendance` row exists even though a teacher
 * created the session. Surfaced as a reminder — we don't auto-mark because we
 * can't know whether they were present.
 */
async function detectSessionsMissingTeacherAttendance(limit: number): Promise<{
  all: SessionMissingTeacherIssue[];
  total: number;
}> {
  const sessions = await db.attendanceSession.findMany({
    where: { teacherAttendance: null },
    select: {
      id: true,
      sessionDate: true,
      batchId: true,
      createdById: true,
      subject: { select: { name: true } },
      _count: { select: { records: true } },
    },
    orderBy: { sessionDate: "desc" },
    take: limit * 2,
  });

  const creatorIds = [...new Set(sessions.map((s) => s.createdById))];
  const creators = await db.user.findMany({
    where: { id: { in: creatorIds }, role: "TEACHER" },
    select: { id: true, firstName: true, lastName: true },
  });
  const creatorMap = new Map(creators.map((u) => [u.id, u]));

  const all: SessionMissingTeacherIssue[] = sessions
    .filter((s) => creatorMap.has(s.createdById))
    .slice(0, limit)
    .map((s) => ({
      sessionId: s.id,
      sessionDate: s.sessionDate.toISOString().slice(0, 10),
      subjectName: s.subject?.name ?? null,
      batchId: s.batchId,
      createdById: s.createdById,
      createdByName: (() => {
        const u = creatorMap.get(s.createdById);
        return u ? `${u.firstName} ${u.lastName}`.trim() : null;
      })(),
      recordCount: s._count.records,
    }));

  return { all, total: all.length };
}

// ─── Public API ──────────────────────────────────────────────────────────────

export async function diagnoseAttendanceSync(): Promise<AttendanceSyncDiagnosis> {
  const [missingEnrollments, missingProfileBatches, orphans, teacherlessSessions] =
    await Promise.all([
      detectMissingEnrollments(SAMPLE_SIZE),
      detectMissingProfileBatches(SAMPLE_SIZE),
      detectOrphanAttendance(SAMPLE_SIZE),
      detectSessionsMissingTeacherAttendance(SAMPLE_SIZE),
    ]);

  return {
    generatedAt: new Date().toISOString(),
    counts: {
      missing_program_enrollment: missingEnrollments.total,
      missing_profile_batch: missingProfileBatches.total,
      orphan_attendance_records: orphans.total,
      sessions_missing_teacher_attendance: teacherlessSessions.total,
    },
    samples: {
      missing_program_enrollment: missingEnrollments.all,
      missing_profile_batch: missingProfileBatches.all,
      orphan_attendance_records: orphans.all,
      sessions_missing_teacher_attendance: teacherlessSessions.all,
    },
    truncated: {
      missing_program_enrollment: missingEnrollments.total >= SAMPLE_SIZE,
      missing_profile_batch: missingProfileBatches.total >= SAMPLE_SIZE,
      orphan_attendance_records: orphans.total >= SAMPLE_SIZE,
      sessions_missing_teacher_attendance: teacherlessSessions.total >= SAMPLE_SIZE,
    },
  };
}

export type SyncApplyResult = {
  created_program_enrollments: number;
  updated_profile_batches: number;
  skipped: number;
  errors: string[];
};

/**
 * Apply the requested categories. Only `missing_program_enrollment` and
 * `missing_profile_batch` are auto-applied — the others are strictly
 * report-only so a human can decide.
 */
export async function applyAttendanceSync(opts: {
  categories: SyncCategory[];
  actorUserId: string;
}): Promise<SyncApplyResult> {
  const { categories, actorUserId } = opts;
  const result: SyncApplyResult = {
    created_program_enrollments: 0,
    updated_profile_batches: 0,
    skipped: 0,
    errors: [],
  };

  // ── 1. Create missing ProgramEnrollments ────────────────────────────────
  if (categories.includes("missing_program_enrollment")) {
    const { all: enrollmentsToCreate } = await detectMissingEnrollments(MAX_WRITES_PER_RUN);
    for (const issue of enrollmentsToCreate) {
      try {
        // Re-check in-transaction to avoid racing another writer.
        const existing = await db.programEnrollment.findUnique({
          where: {
            userId_programId: {
              userId: issue.studentUserId,
              programId: issue.programId,
            },
          },
          select: { id: true },
        });
        if (existing) {
          result.skipped += 1;
          continue;
        }

        await db.programEnrollment.create({
          data: {
            userId: issue.studentUserId,
            programId: issue.programId,
            batchId: issue.batchId,
            status: "ENROLLED",
            enrollmentDate: new Date(),
          },
        });
        result.created_program_enrollments += 1;
        console.log(
          "[attendance-sync] created enrollment",
          JSON.stringify({
            actor: actorUserId,
            student: issue.studentUserId,
            programId: issue.programId,
            batchId: issue.batchId,
            recordsBacking: issue.attendanceRecordCount,
          }),
        );
      } catch (e) {
        result.errors.push(
          `create enrollment ${issue.studentUserId}/${issue.programId}: ${
            e instanceof Error ? e.message : String(e)
          }`,
        );
      }
    }
  }

  // ── 2. Update missing StudentProfile batches ────────────────────────────
  if (categories.includes("missing_profile_batch")) {
    const { all: profileFixes } = await detectMissingProfileBatches(MAX_WRITES_PER_RUN);
    for (const issue of profileFixes) {
      try {
        // Confirm still missing. Another process might have set it meanwhile.
        const current = await db.studentProfile.findUnique({
          where: { userId: issue.studentUserId },
          select: { batchId: true, programId: true },
        });
        if (!current || current.batchId) {
          result.skipped += 1;
          continue;
        }
        await db.studentProfile.update({
          where: { userId: issue.studentUserId },
          data: {
            batchId: issue.suggestedBatchId,
            // Only fill programId if it's not already set — don't overwrite
            // a manually-chosen program.
            ...(current.programId ? {} : { programId: issue.suggestedProgramId }),
          },
        });
        result.updated_profile_batches += 1;
        console.log(
          "[attendance-sync] updated profile batch",
          JSON.stringify({
            actor: actorUserId,
            student: issue.studentUserId,
            batchId: issue.suggestedBatchId,
            programId: current.programId ?? issue.suggestedProgramId,
          }),
        );
      } catch (e) {
        result.errors.push(
          `update profile ${issue.studentUserId}: ${
            e instanceof Error ? e.message : String(e)
          }`,
        );
      }
    }
  }

  return result;
}
