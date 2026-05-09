export type GradeBandRow = {
  id: string;
  label: string;
  minPercent: number;
  maxPercent: number;
  gradePoint: number | null;
  sortOrder: number;
};

/**
 * When no grade bands exist in Settings, transcript UIs still show letter grades
 * using this standard 0–100 scale (avoids empty "Grade" columns in production).
 */
export const DEFAULT_TRANSCRIPT_GRADE_BANDS: GradeBandRow[] = [
  { id: "__def_a+", label: "A+", minPercent: 90, maxPercent: 100, gradePoint: null, sortOrder: 0 },
  { id: "__def_a", label: "A", minPercent: 80, maxPercent: 89, gradePoint: null, sortOrder: 1 },
  { id: "__def_b", label: "B", minPercent: 70, maxPercent: 79, gradePoint: null, sortOrder: 2 },
  { id: "__def_c", label: "C", minPercent: 60, maxPercent: 69, gradePoint: null, sortOrder: 3 },
  { id: "__def_d", label: "D", minPercent: 50, maxPercent: 59, gradePoint: null, sortOrder: 4 },
  { id: "__def_f", label: "F", minPercent: 0, maxPercent: 49, gradePoint: null, sortOrder: 5 },
];

/** Resolve grade label from configured bands for a given percentage. */
export function resolveGrade(pct: number | null | undefined, bands: GradeBandRow[]): string {
  if (pct == null) return "—";
  const effective = bands.length > 0 ? bands : DEFAULT_TRANSCRIPT_GRADE_BANDS;
  const sorted = [...effective].sort((a, b) => b.minPercent - a.minPercent);
  const match = sorted.find((b) => pct >= b.minPercent && pct <= b.maxPercent);
  return match?.label ?? "—";
}

/** Compute final % for a subject row: manualMarksPct takes precedence over autoMarksPct. */
export function finalPct(row: { autoMarksPct?: number | null; manualMarksPct?: number | null }): number | null {
  if (row.manualMarksPct != null) return row.manualMarksPct;
  return row.autoMarksPct ?? null;
}

/** Letter grade for a transcript row: uses final % (stored or derived), bands (or defaults), then persisted grade. */
export function transcriptSubjectGrade(
  s: {
    finalMarksPct?: number | null;
    autoMarksPct?: number | null;
    manualMarksPct?: number | null;
    grade?: string | null;
  },
  bands: GradeBandRow[]
): string {
  const pct = s.finalMarksPct ?? finalPct(s);
  const fromBands = resolveGrade(pct, bands);
  if (fromBands !== "—") return fromBands;
  const stored = s.grade?.trim();
  if (stored && stored !== "—") return stored;
  return "—";
}
