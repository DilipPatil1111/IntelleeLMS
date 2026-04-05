import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { hasTeacherPortalAccess } from "@/lib/portal-access";
import { getOrCreateProgramSyllabus, staffCanAccessProgram } from "@/lib/program-content";
import { NextResponse } from "next/server";

export const runtime = "nodejs";

export async function PUT(req: Request, { params }: { params: Promise<{ programId: string }> }) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!hasTeacherPortalAccess(session)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { programId } = await params;
  const can = await staffCanAccessProgram(session.user.id, "TEACHER", programId);
  if (!can) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const body = (await req.json()) as {
    instructions?: string | null;
    programHours?: string | null;
    feesNote?: string | null;
    isPublished?: boolean;
  };

  await getOrCreateProgramSyllabus(programId);
  const syllabus = await db.programSyllabus.update({
    where: { programId },
    data: {
      instructions: body.instructions !== undefined ? body.instructions : undefined,
      programHours: body.programHours !== undefined ? body.programHours : undefined,
      feesNote: body.feesNote !== undefined ? body.feesNote : undefined,
      isPublished: body.isPublished !== undefined ? body.isPublished : undefined,
    },
  });

  return NextResponse.json({ syllabus });
}
