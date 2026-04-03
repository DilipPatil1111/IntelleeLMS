import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { NextResponse } from "next/server";

/** Programs with subjects and batches for principal teacher course assignment. */
export async function GET() {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const programs = await db.program.findMany({
    where: { isActive: true },
    include: {
      subjects: {
        where: { isActive: true },
        select: { id: true, name: true, code: true, programId: true },
        orderBy: { name: "asc" },
      },
      batches: {
        where: { isActive: true },
        select: { id: true, name: true, programId: true, startDate: true, endDate: true },
        orderBy: { name: "asc" },
      },
    },
    orderBy: { name: "asc" },
  });

  return NextResponse.json({ programs });
}
