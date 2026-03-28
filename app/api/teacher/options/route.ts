import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { NextResponse } from "next/server";

type OptionRow = { value: string; label: string; programId: string };

/**
 * Dropdown data for teacher flows (assessments, attendance, etc.).
 * Uses the full active catalog: programs, subjects, and batches in the institution.
 * Relying only on TeacherProgram / TeacherSubjectAssignment left teachers with empty
 * lists when principals had not yet linked them.
 */
export async function GET() {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const user = await db.user.findUnique({
    where: { id: session.user.id },
    select: { role: true },
  });

  if (user?.role !== "TEACHER") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const [programRows, subjectRows, batchRows] = await Promise.all([
    db.program.findMany({
      where: { isActive: true },
      orderBy: { name: "asc" },
      select: { id: true, name: true },
    }),
    db.subject.findMany({
      where: { isActive: true },
      include: { program: true },
      orderBy: { name: "asc" },
    }),
    db.batch.findMany({
      where: { isActive: true },
      include: { program: true },
      orderBy: { name: "asc" },
    }),
  ]);

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
