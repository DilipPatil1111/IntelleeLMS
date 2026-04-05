import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { hasPrincipalPortalAccess } from "@/lib/portal-access";
import { staffCanAccessProgram } from "@/lib/program-content";
import { NextResponse } from "next/server";

export const runtime = "nodejs";

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!hasPrincipalPortalAccess(session)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const body = (await req.json()) as {
    subjectId: string;
    title: string;
    sortOrder?: number;
    isMandatory?: boolean;
    freePreviewLesson?: boolean;
    isPrerequisite?: boolean;
    enableDiscussions?: boolean;
  };

  if (!body.subjectId || !body.title?.trim()) {
    return NextResponse.json({ error: "subjectId and title required" }, { status: 400 });
  }

  const subject = await db.subject.findUnique({ where: { id: body.subjectId } });
  if (!subject) return NextResponse.json({ error: "Subject not found" }, { status: 404 });

  const can = await staffCanAccessProgram(session.user.id, "PRINCIPAL", subject.programId);
  if (!can) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const maxOrder = await db.programChapter.aggregate({
    where: { subjectId: body.subjectId },
    _max: { sortOrder: true },
  });
  const sortOrder = body.sortOrder ?? (maxOrder._max.sortOrder ?? -1) + 1;

  const chapter = await db.programChapter.create({
    data: {
      subjectId: body.subjectId,
      title: body.title.trim(),
      sortOrder,
      isMandatory: body.isMandatory ?? false,
      freePreviewLesson: body.freePreviewLesson ?? false,
      isPrerequisite: body.isPrerequisite ?? false,
      enableDiscussions: body.enableDiscussions ?? false,
    },
  });

  return NextResponse.json({ chapter });
}
