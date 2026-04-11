import { db } from "@/lib/db";
import type { ProgramLessonKind, Role, StudentStatus } from "@/app/generated/prisma/enums";
import type { Session } from "next-auth";
import { isTeacherOwnershipRestricted } from "@/lib/portal-access";
import { studentVisibleAssessmentFilter } from "@/lib/assessment-assigned-students";

/**
 * @param roleOrSession – pass a Session to auto-detect the real role,
 *   or the legacy Role string for backward-compat callers.
 */
export async function staffCanAccessProgram(
  userId: string,
  roleOrSession: Role | Session,
  programId: string,
): Promise<boolean> {
  let restricted = true;

  if (typeof roleOrSession === "string") {
    restricted = roleOrSession !== "PRINCIPAL";
  } else {
    restricted = isTeacherOwnershipRestricted(roleOrSession);
  }

  if (!restricted) {
    const p = await db.program.findUnique({ where: { id: programId } });
    return !!p;
  }

  const tp = await db.teacherProfile.findUnique({
    where: { userId },
    include: { teacherPrograms: { where: { programId } } },
  });
  return (tp?.teacherPrograms.length ?? 0) > 0;
}

export async function getOrCreateProgramSyllabus(programId: string) {
  let s = await db.programSyllabus.findUnique({ where: { programId } });
  if (!s) {
    s = await db.programSyllabus.create({
      data: { programId },
    });
  }
  return s;
}

export async function fetchProgramContentTree(programId: string) {
  const program = await db.program.findUnique({
    where: { id: programId },
    include: {
      programSyllabus: true,
      subjects: {
        orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
        include: {
          programChapters: {
            orderBy: { sortOrder: "asc" },
            include: {
              lessons: { orderBy: { sortOrder: "asc" } },
            },
          },
        },
      },
    },
  });
  return program;
}

/** Published, non-draft lessons required for completion checks. */
export async function getRequiredLessonsForProgram(programId: string) {
  const syllabus = await db.programSyllabus.findUnique({ where: { programId } });
  if (!syllabus?.isPublished) return [];

  return db.programLesson.findMany({
    where: {
      isDraft: false,
      chapter: {
        subject: { programId },
      },
    },
    include: {
      chapter: { include: { subject: true } },
      assessment: true,
    },
  });
}

export async function isLessonSatisfiedForStudent(
  studentUserId: string,
  lesson: {
    id: string;
    kind: ProgramLessonKind;
    assessmentId: string | null;
  }
): Promise<boolean> {
  if (lesson.kind === "QUIZ" && lesson.assessmentId) {
    const attempt = await db.attempt.findFirst({
      where: {
        studentId: studentUserId,
        assessmentId: lesson.assessmentId,
        status: { in: ["SUBMITTED", "GRADED"] },
      },
    });
    return !!attempt;
  }
  const done = await db.programLessonCompletion.findUnique({
    where: {
      studentUserId_lessonId: { studentUserId, lessonId: lesson.id },
    },
  });
  return !!done;
}

export async function isProgramContentCompleteForStudent(
  studentUserId: string,
  programId: string
): Promise<boolean> {
  const lessons = await getRequiredLessonsForProgram(programId);
  // No published lessons means no lesson requirements — treated as complete
  for (const lesson of lessons) {
    const ok = await isLessonSatisfiedForStudent(studentUserId, lesson);
    if (!ok) return false;
  }

  // Check that the student has no pending (unattempted) assessments
  const pending = await countPendingAssessmentsForProgram(studentUserId, programId);
  if (pending > 0) return false;

  // Check for unresolved retake requests — student shouldn't be eligible while
  // a retake decision is still PENDING
  try {
    const pendingRetakes = await db.assessmentRetakeRequest.count({
      where: {
        studentUserId,
        status: "PENDING",
        assessment: { subject: { programId } },
      },
    });
    if (pendingRetakes > 0) return false;
  } catch {
    // Table may not exist yet before migration runs
  }

  return true;
}

/**
 * Count published assessments assigned to this student (via their batch in
 * the given program) that have no SUBMITTED or GRADED attempt yet.
 */
async function countPendingAssessmentsForProgram(
  studentUserId: string,
  programId: string,
): Promise<number> {
  // Find the student's batch(es) for this program
  const profile = await db.studentProfile.findUnique({
    where: { userId: studentUserId },
    select: { programId: true, batchId: true },
  });
  const enrollment = await db.programEnrollment.findUnique({
    where: { userId_programId: { userId: studentUserId, programId } },
    select: { batchId: true },
  });
  const batchId =
    (profile?.programId === programId ? profile.batchId : null) ??
    enrollment?.batchId ??
    null;
  if (!batchId) return 0;

  try {
    return await db.assessment.count({
      where: {
        status: "PUBLISHED",
        subject: { programId },
        attempts: { none: { studentId: studentUserId } },
        AND: [studentVisibleAssessmentFilter(studentUserId, batchId)],
      },
    });
  } catch {
    return await db.assessment.count({
      where: {
        batchId,
        status: "PUBLISHED",
        subject: { programId },
        attempts: { none: { studentId: studentUserId } },
      },
    });
  }
}

export type EligibleRow = {
  studentUserId: string;
  firstName: string;
  lastName: string;
  email: string;
  enrollmentNo: string;
  batchName: string;
  eligible: boolean;
  certificateSent: boolean;
  reason?: string;
};

export async function listStudentsForAwardCertificates(
  programId: string,
  batchId?: string | null,
): Promise<EligibleRow[]> {
  const activeStatuses: StudentStatus[] = ["ENROLLED", "COMPLETED", "GRADUATED"];

  const profileWhere: { programId: string; status: { in: StudentStatus[] }; batchId?: string } = {
    programId,
    status: { in: activeStatuses },
  };
  if (batchId) profileWhere.batchId = batchId;

  const profiles = await db.studentProfile.findMany({
    where: profileWhere,
    include: { user: true, batch: { select: { name: true } } },
    orderBy: { enrollmentNo: "asc" },
  });

  const enrollmentWhere: { programId: string; status: { in: StudentStatus[] }; batchId?: string } = {
    programId,
    status: { in: activeStatuses },
  };
  if (batchId) enrollmentWhere.batchId = batchId;

  const enrollments = await db.programEnrollment.findMany({
    where: enrollmentWhere,
    include: {
      user: {
        include: {
          studentProfile: { select: { enrollmentNo: true, batch: { select: { name: true } } } },
        },
      },
      batch: { select: { name: true } },
    },
  });

  const seen = new Set<string>();
  const allStudents: { userId: string; firstName: string; lastName: string; email: string; enrollmentNo: string; batchName: string }[] = [];

  for (const p of profiles) {
    if (!seen.has(p.userId)) {
      seen.add(p.userId);
      allStudents.push({
        userId: p.userId,
        firstName: p.user.firstName,
        lastName: p.user.lastName,
        email: p.user.email,
        enrollmentNo: p.enrollmentNo,
        batchName: p.batch?.name ?? "",
      });
    }
  }
  for (const e of enrollments) {
    if (!seen.has(e.userId)) {
      seen.add(e.userId);
      allStudents.push({
        userId: e.userId,
        firstName: e.user.firstName,
        lastName: e.user.lastName,
        email: e.user.email,
        enrollmentNo: e.user.studentProfile?.enrollmentNo ?? e.enrollmentNo ?? "",
        batchName: e.batch?.name ?? e.user.studentProfile?.batch?.name ?? "",
      });
    }
  }

  const sent = await db.programCertificateSend.findMany({
    where: { programId },
    select: { studentUserId: true },
  });
  const sentSet = new Set(sent.map((s) => s.studentUserId));

  const lessons = await getRequiredLessonsForProgram(programId);

  const rows: EligibleRow[] = [];
  for (const s of allStudents) {
    let lessonsComplete = true;
    let incompleteLessons = 0;
    if (lessons.length === 0) {
      // No published lessons — no lesson requirements to fulfill
      lessonsComplete = true;
    } else {
      for (const lesson of lessons) {
        const ok = await isLessonSatisfiedForStudent(s.userId, lesson);
        if (!ok) { lessonsComplete = false; incompleteLessons++; }
      }
    }

    const pendingAssessments = await countPendingAssessmentsForProgram(s.userId, programId);

    // Check for EXCUSED retake requests (below-passing but excused for certificate)
    let excusedCount = 0;
    try {
      excusedCount = await db.assessmentRetakeRequest.count({
        where: {
          studentUserId: s.userId,
          status: "EXCUSED",
          assessment: { subject: { programId } },
        },
      });
    } catch {
      // Table may not exist yet before migration runs
    }

    // A program with no published lessons is treated as having no lesson requirements
    const eligible = lessonsComplete && pendingAssessments === 0;

    let reason: string | undefined;
    if (!eligible) {
      const parts: string[] = [];
      if (incompleteLessons > 0) parts.push(`${incompleteLessons} lesson${incompleteLessons !== 1 ? "s" : ""} incomplete`);
      if (pendingAssessments > 0) parts.push(`${pendingAssessments} assessment${pendingAssessments !== 1 ? "s" : ""} pending`);
      reason = parts.join(", ") || "Incomplete";
    } else if (excusedCount > 0) {
      reason = `${excusedCount} assessment${excusedCount !== 1 ? "s" : ""} excused`;
    }

    rows.push({
      studentUserId: s.userId,
      firstName: s.firstName,
      lastName: s.lastName,
      email: s.email,
      enrollmentNo: s.enrollmentNo,
      batchName: s.batchName,
      eligible,
      certificateSent: sentSet.has(s.userId),
      reason,
    });
  }
  return rows;
}

/**
 * Bulk mark all non-QUIZ published lessons complete for given students in a program.
 */
export async function bulkMarkProgramComplete(
  programId: string,
  studentUserIds: string[],
): Promise<{ lessonsMarked: number; studentsMarked: number }> {
  const lessons = await getRequiredLessonsForProgram(programId);
  const nonQuizLessons = lessons.filter((l) => l.kind !== "QUIZ");
  for (const studentUserId of studentUserIds) {
    for (const lesson of nonQuizLessons) {
      await db.programLessonCompletion.upsert({
        where: { studentUserId_lessonId: { studentUserId, lessonId: lesson.id } },
        create: { studentUserId, lessonId: lesson.id },
        update: {},
      });
    }
  }
  return { lessonsMarked: nonQuizLessons.length, studentsMarked: studentUserIds.length };
}

/**
 * Fetch distinct batches that have enrolled students for a given program.
 */
export async function listBatchesForProgram(programId: string): Promise<{ id: string; name: string }[]> {
  const batches = await db.batch.findMany({
    where: {
      OR: [
        { students: { some: { programId, status: { in: ["ENROLLED", "COMPLETED", "GRADUATED"] } } } },
        { programEnrollments: { some: { programId, status: { in: ["ENROLLED", "COMPLETED", "GRADUATED"] } } } },
      ],
    },
    select: { id: true, name: true },
    orderBy: { name: "asc" },
  });
  return batches;
}

export async function countIncompleteProgramContentItems(
  studentUserId: string,
  programId: string
): Promise<{ total: number; incomplete: number }> {
  const lessons = await getRequiredLessonsForProgram(programId);
  if (lessons.length === 0) return { total: 0, incomplete: 0 };
  let incomplete = 0;
  for (const lesson of lessons) {
    const ok = await isLessonSatisfiedForStudent(studentUserId, lesson);
    if (!ok) incomplete++;
  }
  return { total: lessons.length, incomplete };
}
