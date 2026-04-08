import { db } from "@/lib/db";
import type { ProgramLessonKind, Role } from "@/app/generated/prisma/enums";
import type { Session } from "next-auth";
import { isTeacherOwnershipRestricted } from "@/lib/portal-access";

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
  if (lessons.length === 0) return false;
  for (const lesson of lessons) {
    const ok = await isLessonSatisfiedForStudent(studentUserId, lesson);
    if (!ok) return false;
  }
  return true;
}

export type EligibleRow = {
  studentUserId: string;
  firstName: string;
  lastName: string;
  email: string;
  enrollmentNo: string;
  eligible: boolean;
  certificateSent: boolean;
};

export async function listStudentsForAwardCertificates(programId: string): Promise<EligibleRow[]> {
  // Students from StudentProfile (legacy single-program field)
  const profiles = await db.studentProfile.findMany({
    where: {
      programId,
      status: { in: ["ENROLLED", "COMPLETED", "GRADUATED"] },
    },
    include: { user: true },
    orderBy: { enrollmentNo: "asc" },
  });

  // Also include students enrolled via ProgramEnrollment (multi-program support)
  const enrollments = await db.programEnrollment.findMany({
    where: {
      programId,
      status: { in: ["ENROLLED", "COMPLETED", "GRADUATED"] },
    },
    include: {
      user: {
        include: {
          studentProfile: { select: { enrollmentNo: true } },
        },
      },
    },
  });

  // Merge both sets, dedup by userId
  const seen = new Set<string>();
  const allStudents: { userId: string; firstName: string; lastName: string; email: string; enrollmentNo: string }[] = [];

  for (const p of profiles) {
    if (!seen.has(p.userId)) {
      seen.add(p.userId);
      allStudents.push({
        userId: p.userId,
        firstName: p.user.firstName,
        lastName: p.user.lastName,
        email: p.user.email,
        enrollmentNo: p.enrollmentNo,
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
      });
    }
  }

  const sent = await db.programCertificateSend.findMany({
    where: { programId },
    select: { studentUserId: true },
  });
  const sentSet = new Set(sent.map((s) => s.studentUserId));

  const rows: EligibleRow[] = [];
  for (const s of allStudents) {
    const eligible = await isProgramContentCompleteForStudent(s.userId, programId);
    rows.push({
      studentUserId: s.userId,
      firstName: s.firstName,
      lastName: s.lastName,
      email: s.email,
      enrollmentNo: s.enrollmentNo,
      eligible,
      certificateSent: sentSet.has(s.userId),
    });
  }
  return rows;
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
