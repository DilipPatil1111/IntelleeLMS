import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { NextResponse } from "next/server";

export async function GET() {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

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
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

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
