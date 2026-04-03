import { auth } from "@/lib/auth";
import { hasTeacherPortalAccess } from "@/lib/portal-access";
import { getTeacherCatalogForOptions } from "@/lib/teacher-catalog-options";
import { NextResponse } from "next/server";

type OptionRow = { value: string; label: string; programId: string };

/**
 * Dropdown data for teacher flows (attendance, assessments, etc.).
 * Lists only programs / subjects / batches linked via TeacherSubjectAssignment or
 * TeacherProgram so choices match {@link getTeacherVisibleBatchIds} — student lists
 * and attendance APIs stay consistent.
 */
export async function GET() {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  if (!hasTeacherPortalAccess(session)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { programRows, subjectRows, batchRows } = await getTeacherCatalogForOptions(session.user.id);

  const subjects: OptionRow[] = subjectRows.map((s) => ({
    value: s.id,
    label: `${s.name} (${s.program.name})`,
    programId: s.programId,
  }));

  const batches: OptionRow[] = batchRows.map((b) => ({
    value: b.id,
    label: `${b.name} — ${b.program.name}`,
    programId: b.programId,
  }));

  return NextResponse.json({
    programs: programRows.map((p) => ({ value: p.id, label: p.name })),
    subjects,
    batches,
  });
}
