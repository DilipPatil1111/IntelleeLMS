/**
 * Shared data layer for Principal → Reports → "Performance by Assessment".
 *
 * Owns the Prisma query and pass/fail aggregation so the on-screen view
 * (JSON API), the CSV export, and the PDF export all display identical
 * numbers no matter which filters are applied.
 *
 * Supported filters (all optional; omitted filter = "All"):
 *   - programId  → restricts to batches in that program
 *   - batchId    → restricts to a specific batch
 *   - subjectId  → restricts to a specific subject
 *   - studentId  → restricts BOTH the assessments (must have a graded
 *                  attempt from this student) AND the attempts used for
 *                  pass/fail aggregation (only this student's attempts).
 *                  With studentId set, the report effectively becomes a
 *                  per-student breakdown of every assessment they took.
 */

import { db } from "@/lib/db";
import type { Prisma } from "@/app/generated/prisma/client";

export interface PerformanceReportFilters {
  programId?: string;
  batchId?: string;
  subjectId?: string;
  studentId?: string;
}

export interface PerformanceReportRow {
  id: string;
  title: string;
  subject: string;
  program: string;
  batch: string;
  type: string;
  totalStudents: number;
  passed: number;
  failed: number;
  avgScore: number;
}

export interface PerformanceReportResolvedFilter {
  id: string | null;
  name: string | null;
}

export interface PerformanceReportData {
  collegeName: string;
  generatedAt: string;
  filters: {
    program: PerformanceReportResolvedFilter;
    batch: PerformanceReportResolvedFilter;
    subject: PerformanceReportResolvedFilter;
    student: PerformanceReportResolvedFilter;
  };
  rows: PerformanceReportRow[];
}

function getCollegeName(): string {
  return process.env.NEXT_PUBLIC_COLLEGE_NAME?.trim() || "Intellee College";
}

/**
 * Fetches assessments matching the filters and computes pass/fail/avg.
 * Pass threshold honors each assessment's own passingMarks/totalMarks ratio,
 * falling back to 50% when not configured.
 */
export async function getPerformanceReportData(
  filters: PerformanceReportFilters
): Promise<PerformanceReportData> {
  const { programId, batchId, subjectId, studentId } = filters;

  const where: Prisma.AssessmentWhereInput = {};
  if (subjectId) where.subjectId = subjectId;
  if (batchId) where.batchId = batchId;
  if (programId) where.batch = { programId };
  // When a student is selected, only surface assessments they actually
  // took (otherwise the list would be cluttered with rows showing 0/0).
  if (studentId) {
    where.attempts = { some: { studentId, status: "GRADED" } };
  }

  const assessments = await db.assessment.findMany({
    where,
    include: {
      subject: true,
      batch: { include: { program: true } },
      attempts: {
        where: {
          status: "GRADED",
          ...(studentId ? { studentId } : {}),
        },
        select: { percentage: true, totalScore: true, studentId: true },
      },
    },
    orderBy: { createdAt: "desc" },
  });

  const rows: PerformanceReportRow[] = assessments.map((a) => {
    const threshold =
      a.passingMarks != null && a.totalMarks > 0
        ? (a.passingMarks / a.totalMarks) * 100
        : 50;
    const passed = a.attempts.filter((t) => (t.percentage || 0) >= threshold).length;
    const avgScore =
      a.attempts.length > 0
        ? Math.round(
            a.attempts.reduce((s, t) => s + (t.percentage || 0), 0) / a.attempts.length
          )
        : 0;
    return {
      id: a.id,
      title: a.title,
      subject: a.subject?.name || "",
      batch: a.batch?.name || "",
      program: a.batch?.program?.name || "",
      type: a.type,
      totalStudents: a.attempts.length,
      passed,
      failed: a.attempts.length - passed,
      avgScore,
    };
  });

  // Resolve filter labels so exports can show "Program: Diploma in SE"
  // instead of just the opaque IDs. Each lookup is conditional to keep
  // the query count minimal for the common "All" case.
  const [program, batch, subject, student] = await Promise.all([
    programId
      ? db.program.findUnique({ where: { id: programId }, select: { name: true } })
      : null,
    batchId
      ? db.batch.findUnique({ where: { id: batchId }, select: { name: true } })
      : null,
    subjectId
      ? db.subject.findUnique({ where: { id: subjectId }, select: { name: true } })
      : null,
    studentId
      ? db.user.findUnique({
          where: { id: studentId },
          select: { firstName: true, lastName: true },
        })
      : null,
  ]);

  return {
    collegeName: getCollegeName(),
    generatedAt: new Date().toISOString(),
    filters: {
      program: { id: programId ?? null, name: program?.name ?? null },
      batch: { id: batchId ?? null, name: batch?.name ?? null },
      subject: { id: subjectId ?? null, name: subject?.name ?? null },
      student: {
        id: studentId ?? null,
        name: student
          ? `${student.firstName} ${student.lastName}`.trim() || null
          : null,
      },
    },
    rows,
  };
}

/**
 * Build a well-formed CSV string for the performance report. Each cell is
 * wrapped in double-quotes and internal quotes are escaped so values
 * containing commas, quotes, or newlines round-trip cleanly through Excel
 * / Google Sheets.
 */
export function buildPerformanceReportCsv(data: PerformanceReportData): string {
  const esc = (v: string | number) => `"${String(v).replace(/"/g, '""')}"`;
  const lines: string[] = [];

  lines.push(
    [
      "Assessment",
      "Subject",
      "Program",
      "Batch",
      "Type",
      "Students",
      "Passed",
      "Failed",
      "Avg Score %",
    ]
      .map(esc)
      .join(",")
  );

  for (const r of data.rows) {
    lines.push(
      [
        r.title,
        r.subject,
        r.program,
        r.batch,
        r.type,
        r.totalStudents,
        r.passed,
        r.failed,
        r.avgScore,
      ]
        .map(esc)
        .join(",")
    );
  }

  return lines.join("\n");
}

/**
 * Turns the non-null filter names into a short file slug, e.g.
 * "Diploma_SE-Fall2025-JaneDoe". Used for download filenames so the user
 * can tell exports apart in their Downloads folder.
 */
export function buildPerformanceReportFilenameSlug(
  data: PerformanceReportData
): string {
  const parts: string[] = [];
  if (data.filters.program.name) parts.push(data.filters.program.name);
  if (data.filters.batch.name) parts.push(data.filters.batch.name);
  if (data.filters.subject.name) parts.push(data.filters.subject.name);
  if (data.filters.student.name) parts.push(data.filters.student.name);
  const slug = parts
    .join("_")
    .replace(/[^\w\-]+/g, "_")
    .replace(/_{2,}/g, "_")
    .replace(/^_|_$/g, "")
    .slice(0, 80);
  return slug || "all";
}
