import { auth } from "@/lib/auth";
import { hasStudentPortalAccess } from "@/lib/portal-access";
import { db } from "@/lib/db";
import { resolveGrade } from "@/lib/transcript";
import { NextResponse } from "next/server";

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!hasStudentPortalAccess(session)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const [transcripts, bands] = await Promise.all([
    db.transcript.findMany({
      where: { studentId: session.user.id, status: "PUBLISHED" },
      include: {
        program: { select: { name: true } },
        batch: { select: { name: true } },
        subjects: { orderBy: { sortOrder: "asc" } },
      },
      orderBy: { publishedAt: "desc" },
    }),
    db.gradeBand.findMany({ orderBy: { sortOrder: "asc" } }),
  ]);

  // Always return live-computed grades from current grade bands.
  // Use stored finalMarksPct (the definitive value).
  const fresh = transcripts.map((t) => ({
    ...t,
    subjects: t.subjects.map((s) => ({
      ...s,
      grade: resolveGrade(s.finalMarksPct, bands),
    })),
  }));

  return NextResponse.json({ transcripts: fresh });
}
