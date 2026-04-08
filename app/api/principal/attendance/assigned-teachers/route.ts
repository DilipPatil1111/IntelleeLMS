import { requirePrincipalPortal } from "@/lib/api-auth";
import { db } from "@/lib/db";
import { NextResponse } from "next/server";

/** Teachers assigned to the given program (TeacherProgram) and/or batch (TeacherSubjectAssignment). */
export async function GET(req: Request) {
  const gate = await requirePrincipalPortal();
  if (!gate.ok) return gate.response;
  const session = gate.session;

  const { searchParams } = new URL(req.url);
  const programId = searchParams.get("programId")?.trim() || undefined;
  const batchId = searchParams.get("batchId")?.trim() || undefined;

  if (!programId && !batchId) {
    return NextResponse.json({ teachers: [] });
  }

  type T = { id: string; firstName: string; lastName: string };
  const byId = new Map<string, T>();

  if (batchId) {
    const rows = await db.teacherSubjectAssignment.findMany({
      where: { batchId },
      select: {
        teacherProfile: {
          select: {
            user: { select: { id: true, firstName: true, lastName: true } },
          },
        },
      },
    });
    for (const r of rows) {
      const u = r.teacherProfile.user;
      byId.set(u.id, u);
    }
  } else if (programId) {
    const rows = await db.teacherProgram.findMany({
      where: { programId },
      select: {
        teacherProfile: {
          select: {
            user: { select: { id: true, firstName: true, lastName: true } },
          },
        },
      },
    });
    for (const r of rows) {
      const u = r.teacherProfile.user;
      byId.set(u.id, u);
    }
  }

  const teachers = [...byId.values()].sort(
    (a, b) =>
      a.firstName.localeCompare(b.firstName, undefined, { sensitivity: "base" }) ||
      a.lastName.localeCompare(b.lastName, undefined, { sensitivity: "base" })
  );

  return NextResponse.json({ teachers });
}
