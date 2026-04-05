import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { hasTeacherPortalAccess } from "@/lib/portal-access";
import { staffCanAccessProgram } from "@/lib/program-content";
import { NextResponse } from "next/server";

export const runtime = "nodejs";

/** PATCH /api/teacher/program-content/subjects/reorder
 *  Body: { programId: string; orderedIds: string[] }
 */
export async function PATCH(req: Request) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!hasTeacherPortalAccess(session)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const body = (await req.json()) as { programId?: string; orderedIds?: string[] };
  if (!body.programId || !Array.isArray(body.orderedIds)) {
    return NextResponse.json({ error: "programId and orderedIds required" }, { status: 400 });
  }

  const can = await staffCanAccessProgram(session.user.id, "TEACHER", body.programId);
  if (!can) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  await Promise.all(
    body.orderedIds.map((id, idx) => db.subject.update({ where: { id }, data: { sortOrder: idx } }))
  );

  return NextResponse.json({ ok: true });
}
