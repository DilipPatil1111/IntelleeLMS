import { requirePrincipalPortal } from "@/lib/api-auth";
import { db } from "@/lib/db";
import { NextResponse } from "next/server";

export async function PUT(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const gate = await requirePrincipalPortal();
  if (!gate.ok) return gate.response;
  const session = gate.session;

  const body = await req.json();
  const batch = await db.batch.update({
    where: { id },
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

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const gate2 = await requirePrincipalPortal();
  if (!gate2.ok) return gate2.response;
  const session = gate2.session;

  await db.batch.delete({ where: { id } });
  return NextResponse.json({ success: true });
}
