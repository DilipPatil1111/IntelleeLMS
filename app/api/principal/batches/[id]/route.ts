import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { NextResponse } from "next/server";

export async function PUT(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

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
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  await db.batch.delete({ where: { id } });
  return NextResponse.json({ success: true });
}
