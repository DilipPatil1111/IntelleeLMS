import type { Session } from "next-auth";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { hasPrincipalPortalAccess } from "@/lib/portal-access";
import { NextResponse } from "next/server";

function requirePrincipalId(session: Session | null): string | null {
  if (!session?.user?.id) return null;
  if (!hasPrincipalPortalAccess(session)) return null;
  return session.user.id;
}

export async function GET(req: Request) {
  const session = await auth();
  if (!requirePrincipalId(session)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const batchId = new URL(req.url).searchParams.get("batchId");
  if (!batchId) return NextResponse.json({ error: "batchId required" }, { status: 400 });

  const rows = await db.teacherSubjectAssignment.findMany({
    where: { batchId },
    include: {
      teacherProfile: {
        include: { user: { select: { id: true, firstName: true, lastName: true, email: true } } },
      },
      subject: { select: { id: true, name: true, code: true } },
    },
  });

  const teachers = new Map<
    string,
    { id: string; firstName: string; lastName: string; email: string; subjects: { id: string; name: string }[] }
  >();
  for (const r of rows) {
    const u = r.teacherProfile.user;
    const existing = teachers.get(u.id);
    const subj = { id: r.subject.id, name: r.subject.name };
    if (!existing) {
      teachers.set(u.id, {
        id: u.id,
        firstName: u.firstName,
        lastName: u.lastName,
        email: u.email,
        subjects: [subj],
      });
    } else if (!existing.subjects.some((s) => s.id === subj.id)) {
      existing.subjects.push(subj);
    }
  }

  return NextResponse.json({ teachers: [...teachers.values()] });
}
