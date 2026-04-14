import { requireStudentPortal } from "@/lib/api-auth";
import { db } from "@/lib/db";
import { NextResponse } from "next/server";

/** Teachers assigned to the current student's batch (for optional "about this teacher" feedback). */
export async function GET() {
  const gate = await requireStudentPortal();
  if (!gate.ok) return gate.response;
  const session = gate.session;

  const sp = await db.studentProfile.findUnique({
    where: { userId: session.user.id },
    select: { batchId: true },
  });
  if (!sp?.batchId) return NextResponse.json({ teachers: [] });

  const assignments = await db.teacherSubjectAssignment.findMany({
    where: { batchId: sp.batchId },
    include: {
      teacherProfile: {
        include: {
          user: { select: { id: true, firstName: true, lastName: true, email: true } },
        },
      },
    },
  });

  const map = new Map<string, { id: string; firstName: string; lastName: string; email: string }>();
  for (const a of assignments) {
    const u = a.teacherProfile.user;
    map.set(u.id, u);
  }

  return NextResponse.json({ teachers: [...map.values()].sort((a, b) => a.lastName.localeCompare(b.lastName)) });
}
