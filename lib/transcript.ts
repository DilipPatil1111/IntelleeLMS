import { db } from "@/lib/db";

export type GradeBandRow = {
  id: string;
  label: string;
  minPercent: number;
  maxPercent: number;
  gradePoint: number | null;
  sortOrder: number;
};

export type TranscriptSubjectInput = {
  id?: string;
  subjectCode?: string;
  subjectName: string;
  description?: string;
  autoMarksPct?: number | null;
  manualMarksPct?: number | null;
  sortOrder?: number;
};

/** Resolve grade label from configured bands for a given percentage. */
export function resolveGrade(pct: number | null | undefined, bands: GradeBandRow[]): string {
  if (pct == null) return "—";
  const sorted = [...bands].sort((a, b) => b.minPercent - a.minPercent);
  const match = sorted.find((b) => pct >= b.minPercent && pct <= b.maxPercent);
  return match?.label ?? "—";
}

/** Compute final % for a subject row: manualMarksPct takes precedence over autoMarksPct. */
export function finalPct(row: { autoMarksPct?: number | null; manualMarksPct?: number | null }): number | null {
  if (row.manualMarksPct != null) return row.manualMarksPct;
  return row.autoMarksPct ?? null;
}

export type TranscriptWithDetails = Awaited<ReturnType<typeof getTranscriptById>>;

export async function getTranscriptById(id: string) {
  return db.transcript.findUnique({
    where: { id },
    include: {
      student: { select: { id: true, firstName: true, lastName: true, email: true, address: true, city: true, state: true, postalCode: true, country: true, studentProfile: { select: { enrollmentNo: true } } } },
      program: { select: { id: true, name: true, durationText: true, programType: { select: { name: true } }, programCategory: { select: { name: true } } } },
      batch: { select: { id: true, name: true, startDate: true, endDate: true } },
      createdBy: { select: { id: true, firstName: true, lastName: true } },
      subjects: { orderBy: { sortOrder: "asc" } },
    },
  });
}

/** Pull auto assessment averages for a student in a program, grouped by subject. */
export async function computeAutoMarks(studentId: string, programId: string): Promise<Record<string, number>> {
  const subjects = await db.subject.findMany({
    where: { programId },
    select: { id: true, name: true },
  });

  const result: Record<string, number> = {};

  for (const subj of subjects) {
    const attempts = await db.attempt.findMany({
      where: {
        studentId,
        status: "GRADED",
        assessment: {
          subject: { id: subj.id },
          type: { in: ["QUIZ", "TEST", "ASSIGNMENT", "PROJECT"] },
        },
      },
      select: { percentage: true },
    });

    if (attempts.length > 0) {
      const avg = attempts.reduce((s, a) => s + (a.percentage ?? 0), 0) / attempts.length;
      result[subj.id] = Math.round(avg * 10) / 10;
    }
  }

  return result;
}

/** Compute overall average from subject rows that have a final %. */
export function computeOverallAvg(subjects: { finalMarksPct?: number | null }[]): number | null {
  const valid = subjects.map((s) => s.finalMarksPct).filter((v): v is number => v != null);
  if (valid.length === 0) return null;
  return Math.round((valid.reduce((s, v) => s + v, 0) / valid.length) * 10) / 10;
}
