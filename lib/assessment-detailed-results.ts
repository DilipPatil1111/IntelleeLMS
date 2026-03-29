import { db } from "@/lib/db";
import { studentVisibleAssessmentFilter } from "@/lib/assessment-assigned-students";
import type { Answer, Question, QuestionOption } from "@/app/generated/prisma/client";

export type PassFail = "PASS" | "FAIL" | "PENDING";

export type QuestionResultRow = {
  orderIndex: number;
  questionText: string;
  questionType: string;
  maxMarks: number;
  studentAnswerDisplay: string;
  correctAnswerDisplay: string;
  isCorrect: boolean | null;
  score: number;
  feedback: string | null;
};

export type StudentAttemptResult = {
  studentId: string;
  studentName: string;
  enrollmentNo: string | null;
  attemptId: string;
  attemptStatus: string;
  startedAt: string;
  submittedAt: string | null;
  durationMinutes: number | null;
  totalScore: number | null;
  percentage: number | null;
  passFail: PassFail;
  questions: QuestionResultRow[];
};

export type AssessmentResultsReportData = {
  collegeName: string;
  generatedAt: string;
  assessment: {
    id: string;
    title: string;
    type: string;
    totalMarks: number;
    passingMarks: number | null;
    durationMinutes: number | null;
    assessmentDate: string | null;
    createdAt: string;
    subjectName: string;
    programName: string;
    batchName: string;
    creatorName: string;
  };
  studentResults: StudentAttemptResult[];
};

function getCollegeName(): string {
  return process.env.NEXT_PUBLIC_COLLEGE_NAME?.trim() || "Intellee College";
}

function passThresholdPercent(assessment: { passingMarks: number | null; totalMarks: number }): number {
  if (assessment.passingMarks != null && assessment.totalMarks > 0) {
    return (assessment.passingMarks / assessment.totalMarks) * 100;
  }
  return 50;
}

function computePassFailWithAssessment(
  attempt: { status: string; percentage: number | null },
  assessment: { passingMarks: number | null; totalMarks: number }
): PassFail {
  if (attempt.status === "IN_PROGRESS") return "PENDING";
  if (attempt.percentage == null) return "PENDING";
  const threshold = passThresholdPercent(assessment);
  return attempt.percentage >= threshold ? "PASS" : "FAIL";
}

function scoreForAnswer(a: Answer): number {
  if (a.manualScore != null) return a.manualScore;
  if (a.autoScore != null) return a.autoScore;
  return 0;
}

function buildQuestionRows(
  questions: (Question & { options: QuestionOption[] })[],
  answersByQuestionId: Map<string, Answer>
): QuestionResultRow[] {
  const sorted = [...questions].sort((a, b) => a.orderIndex - b.orderIndex);
  return sorted.map((q, idx) => {
    const ans = answersByQuestionId.get(q.id);
    const score = ans ? scoreForAnswer(ans) : 0;

    let studentAnswerDisplay = "—";
    let correctAnswerDisplay = "—";
    let isCorrect: boolean | null = null;

    if (q.type === "MCQ") {
      if (ans?.selectedOptionId) {
        const sel = q.options.find((o) => o.id === ans.selectedOptionId);
        studentAnswerDisplay = sel?.optionText ?? ans.selectedOptionId;
        isCorrect = sel?.isCorrect ?? false;
      } else {
        studentAnswerDisplay = "No selection";
        isCorrect = false;
      }
      const correctOpts = q.options.filter((o) => o.isCorrect);
      correctAnswerDisplay =
        correctOpts.length > 0 ? correctOpts.map((o) => o.optionText).join("; ") : q.correctAnswer || "—";
    } else {
      studentAnswerDisplay = ans?.answerText?.trim() || "—";
      if (q.correctAnswer?.trim()) {
        const norm = (s: string) => s.trim().toLowerCase();
        correctAnswerDisplay = q.correctAnswer;
        isCorrect =
          ans?.answerText != null && norm(ans.answerText) === norm(q.correctAnswer);
      } else {
        correctAnswerDisplay = "— (instructor graded)";
        isCorrect = null;
      }
    }

    return {
      orderIndex: idx + 1,
      questionText: q.questionText,
      questionType: q.type,
      maxMarks: q.marks,
      studentAnswerDisplay,
      correctAnswerDisplay,
      isCorrect,
      score,
      feedback: ans?.feedback ?? null,
    };
  });
}

export type GetAssessmentResultsReportOptions = {
  /** When set, only this student's attempt is included (student portal). */
  forStudentId?: string;
};

export async function getAssessmentResultsReportData(
  assessmentId: string,
  options?: GetAssessmentResultsReportOptions
): Promise<AssessmentResultsReportData | null> {
  const forStudentId = options?.forStudentId;

  const assessment = await db.assessment.findUnique({
    where: { id: assessmentId },
    include: {
      subject: true,
      batch: { include: { program: true } },
      creator: { select: { firstName: true, lastName: true, email: true } },
      questions: { include: { options: { orderBy: { orderIndex: "asc" } } }, orderBy: { orderIndex: "asc" } },
      attempts: {
        where: forStudentId ? { studentId: forStudentId } : undefined,
        include: {
          student: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              studentProfile: { select: { enrollmentNo: true } },
            },
          },
          answers: true,
        },
        orderBy: { submittedAt: "desc" },
      },
    },
  });

  if (!assessment) return null;
  if (forStudentId && assessment.attempts.length === 0) return null;

  const thresholdMeta = {
    passingMarks: assessment.passingMarks,
    totalMarks: assessment.totalMarks,
  };

  const studentResults: StudentAttemptResult[] = assessment.attempts.map((attempt) => {
    const answersByQ = new Map<string, Answer>();
    for (const a of attempt.answers) {
      answersByQ.set(a.questionId, a);
    }
    const passFail = computePassFailWithAssessment(attempt, thresholdMeta);

    let durationMinutes: number | null = null;
    if (attempt.submittedAt && attempt.startedAt) {
      const ms = new Date(attempt.submittedAt).getTime() - new Date(attempt.startedAt).getTime();
      if (ms > 0) durationMinutes = Math.round((ms / 60000) * 10) / 10;
    }

    const sp = attempt.student.studentProfile;

    return {
      studentId: attempt.student.id,
      studentName: `${attempt.student.firstName} ${attempt.student.lastName}`,
      enrollmentNo: sp?.enrollmentNo ?? null,
      attemptId: attempt.id,
      attemptStatus: attempt.status,
      startedAt: attempt.startedAt.toISOString(),
      submittedAt: attempt.submittedAt?.toISOString() ?? null,
      durationMinutes,
      totalScore: attempt.totalScore,
      percentage: attempt.percentage,
      passFail,
      questions: buildQuestionRows(assessment.questions, answersByQ),
    };
  });

  return {
    collegeName: getCollegeName(),
    generatedAt: new Date().toISOString(),
    assessment: {
      id: assessment.id,
      title: assessment.title,
      type: assessment.type,
      totalMarks: assessment.totalMarks,
      passingMarks: assessment.passingMarks,
      durationMinutes: assessment.duration ?? null,
      assessmentDate: assessment.assessmentDate?.toISOString() ?? null,
      createdAt: assessment.createdAt.toISOString(),
      subjectName: assessment.subject.name,
      programName: assessment.batch.program.name,
      batchName: assessment.batch.name,
      creatorName: `${assessment.creator.firstName} ${assessment.creator.lastName}`,
    },
    studentResults,
  };
}

export async function canViewAssessmentResults(
  userId: string,
  role: string,
  assessmentId: string
): Promise<boolean> {
  const a = await db.assessment.findUnique({
    where: { id: assessmentId },
    select: { createdById: true },
  });
  if (!a) return false;
  if (role === "PRINCIPAL") return true;
  if (role === "TEACHER" && a.createdById === userId) return true;
  return false;
}

/**
 * Student may load their own detailed results if the assessment is visible to them and they have an attempt.
 */
export async function canStudentViewOwnAssessmentResults(studentUserId: string, assessmentId: string): Promise<boolean> {
  const user = await db.user.findUnique({
    where: { id: studentUserId },
    select: { studentProfile: { select: { batchId: true } } },
  });
  const batchId = user?.studentProfile?.batchId;
  if (!batchId) return false;

  const row = await db.assessment.findFirst({
    where: {
      id: assessmentId,
      AND: [studentVisibleAssessmentFilter(studentUserId, batchId)],
      attempts: { some: { studentId: studentUserId } },
    },
    select: { id: true },
  });
  return !!row;
}
