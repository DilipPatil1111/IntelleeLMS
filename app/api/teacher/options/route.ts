import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { NextResponse } from "next/server";

type OptionRow = { value: string; label: string; programId: string };

function dedupeByValue<T extends { value: string }>(rows: T[]): T[] {
  const seen = new Set<string>();
  return rows.filter((r) => {
    if (seen.has(r.value)) return false;
    seen.add(r.value);
    return true;
  });
}

export async function GET() {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const user = await db.user.findUnique({
    where: { id: session.user.id },
    include: {
      teacherProfile: {
        include: {
          subjectAssignments: {
            include: {
              subject: { include: { program: true } },
              batch: { include: { program: true } },
            },
          },
          teacherPrograms: true,
        },
      },
    },
  });

  const profile = user?.teacherProfile;
  if (!profile) {
    return NextResponse.json({
      programs: [] as { value: string; label: string }[],
      subjects: [] as OptionRow[],
      batches: [] as OptionRow[],
    });
  }

  const programIdSet = new Set<string>();
  for (const tp of profile.teacherPrograms) {
    programIdSet.add(tp.programId);
  }
  for (const a of profile.subjectAssignments) {
    programIdSet.add(a.subject.programId);
    programIdSet.add(a.batch.programId);
  }

  const programIds = [...programIdSet];

  const fromAssignments: { subjects: OptionRow[]; batches: OptionRow[] } = {
    subjects: profile.subjectAssignments.map((a) => ({
      value: a.subjectId,
      label: `${a.subject.name} (${a.subject.program.name})`,
      programId: a.subject.programId,
    })),
    batches: profile.subjectAssignments.map((a) => ({
      value: a.batchId,
      label: `${a.batch.name} — ${a.batch.program.name}`,
      programId: a.batch.programId,
    })),
  };

  let fromPrograms: { subjects: OptionRow[]; batches: OptionRow[] } = { subjects: [], batches: [] };

  if (programIds.length > 0) {
    const [subjectRows, batchRows] = await Promise.all([
      db.subject.findMany({
        where: { programId: { in: programIds }, isActive: true },
        include: { program: true },
        orderBy: { name: "asc" },
      }),
      db.batch.findMany({
        where: { programId: { in: programIds }, isActive: true },
        include: { program: true },
        orderBy: { name: "asc" },
      }),
    ]);

    fromPrograms = {
      subjects: subjectRows.map((s) => ({
        value: s.id,
        label: `${s.name} (${s.program.name})`,
        programId: s.programId,
      })),
      batches: batchRows.map((b) => ({
        value: b.id,
        label: `${b.name} — ${b.program.name}`,
        programId: b.programId,
      })),
    };
  }

  const subjects = dedupeByValue([...fromAssignments.subjects, ...fromPrograms.subjects]);
  const batches = dedupeByValue([...fromAssignments.batches, ...fromPrograms.batches]);

  const programs =
    programIds.length > 0
      ? await db.program.findMany({
          where: { id: { in: programIds }, isActive: true },
          orderBy: { name: "asc" },
          select: { id: true, name: true },
        })
      : [];

  return NextResponse.json({
    programs: programs.map((p) => ({ value: p.id, label: p.name })),
    subjects,
    batches,
  });
}
