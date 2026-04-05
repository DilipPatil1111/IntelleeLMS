import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { hasStudentPortalAccess } from "@/lib/portal-access";
import { fetchProgramContentTree, getOrCreateProgramSyllabus } from "@/lib/program-content";
import { NextResponse } from "next/server";

export const runtime = "nodejs";

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!hasStudentPortalAccess(session)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const profile = await db.studentProfile.findUnique({
    where: { userId: session.user.id },
    include: { program: true },
  });

  if (!profile?.programId) {
    return NextResponse.json({ program: null, message: "No program enrolled" });
  }

  await getOrCreateProgramSyllabus(profile.programId);
  const program = await fetchProgramContentTree(profile.programId);

  const syllabus = program?.programSyllabus;
  if (!program || !syllabus?.isPublished) {
    return NextResponse.json({
      program: null,
      syllabusPublished: false,
      message: "Program content is not published yet.",
    });
  }

  const filtered = {
    ...program,
    subjects: program.subjects.map((s) => ({
      ...s,
      programChapters: s.programChapters.map((ch) => ({
        ...ch,
        lessons: ch.lessons.filter((l) => !l.isDraft),
      })),
    })),
  };

  return NextResponse.json({ program: filtered, syllabusPublished: true });
}
