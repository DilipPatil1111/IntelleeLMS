import { requireTeacherPortal } from "@/lib/api-auth";
import { db } from "@/lib/db";
import { getTeacherVisibleBatchIds } from "@/lib/teacher-visible-batches";
import { NextResponse } from "next/server";

export async function GET(req: Request) {
  const gate = await requireTeacherPortal();
  if (!gate.ok) return gate.response;
  const session = gate.session;

  const { searchParams } = new URL(req.url);
  const batchId = searchParams.get("batchId");

  if (!batchId) return NextResponse.json({ students: [] });

  const allowed = await getTeacherVisibleBatchIds(session.user.id, session);
  if (!allowed.includes(batchId)) return NextResponse.json({ students: [] });

  const students = await db.user.findMany({
    where: { role: "STUDENT", studentProfile: { batchId } },
    select: { id: true, firstName: true, lastName: true, email: true },
    orderBy: { firstName: "asc" },
  });

  return NextResponse.json({ students });
}
