import { requirePrincipalPortal } from "@/lib/api-auth";
import { db } from "@/lib/db";
import { NextResponse } from "next/server";

export async function GET() {
  const gate = await requirePrincipalPortal();
  if (!gate.ok) return gate.response;
  const session = gate.session;

  const batches = await db.batch.findMany({
    include: {
      program: true,
      academicYear: true,
      _count: { select: { students: true } },
    },
    orderBy: { name: "asc" },
  });

  return NextResponse.json({ batches });
}

export async function POST(req: Request) {
  const gate2 = await requirePrincipalPortal();
  if (!gate2.ok) return gate2.response;
  const session = gate2.session;

  const body = await req.json();
  const batch = await db.batch.create({
    data: {
      name: body.name,
      programId: body.programId,
      academicYearId: body.academicYearId,
      startDate: new Date(body.startDate),
      endDate: new Date(body.endDate),
      isActive: body.isActive ?? true,
    },
    include: {
      program: true,
      academicYear: true,
      _count: { select: { students: true } },
    },
  });

  return NextResponse.json({ batch });
}
