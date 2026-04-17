import { requireTeacherPortal } from "@/lib/api-auth";
import { db } from "@/lib/db";
import { NextResponse } from "next/server";

export async function GET(req: Request) {
  const gate = await requireTeacherPortal();
  if (!gate.ok) return gate.response;

  const { searchParams } = new URL(req.url);
  const batchId = searchParams.get("batchId");
  if (!batchId) return NextResponse.json({ error: "batchId required" }, { status: 400 });

  const enrollments = await db.programEnrollment.findMany({
    where: { batchId, status: { in: ["ENROLLED", "COMPLETED", "GRADUATED"] } },
    select: {
      userId: true,
      user: { select: { firstName: true, lastName: true } },
    },
    orderBy: { user: { firstName: "asc" } },
  });

  const students = enrollments.map((e) => ({
    userId: e.userId,
    name: `${e.user.firstName} ${e.user.lastName}`,
  }));

  return NextResponse.json({ students });
}
