import { db } from "@/lib/db";
import { NextResponse } from "next/server";

/** Public read-only: active programs and batches for registration (no auth). */
export async function GET() {
  const programs = await db.program.findMany({
    where: { isActive: true },
    select: {
      id: true,
      name: true,
      code: true,
      description: true,
      durationText: true,
      durationYears: true,
      batches: {
        where: { isActive: true },
        select: { id: true, name: true, startDate: true, endDate: true },
        orderBy: { name: "asc" },
      },
    },
    orderBy: { name: "asc" },
  });

  return NextResponse.json({ programs });
}
