import { requireTeacherPortal } from "@/lib/api-auth";
import { db } from "@/lib/db";
import { NextResponse } from "next/server";

export async function GET(req: Request) {
  const gate = await requireTeacherPortal();
  if (!gate.ok) return gate.response;

  const { searchParams } = new URL(req.url);
  const programId = searchParams.get("programId");
  if (!programId) return NextResponse.json({ error: "programId required" }, { status: 400 });

  const batches = await db.batch.findMany({
    where: { programId },
    select: { id: true, name: true, startDate: true, endDate: true },
    orderBy: { name: "asc" },
  });

  return NextResponse.json({ batches });
}
