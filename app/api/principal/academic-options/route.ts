import { requirePrincipalPortal } from "@/lib/api-auth";
import { db } from "@/lib/db";
import { NextResponse } from "next/server";

/** Programs with subjects and batches for principal teacher course assignment. */
export async function GET() {
  const gate = await requirePrincipalPortal();
  if (!gate.ok) return gate.response;
  const session = gate.session;

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
