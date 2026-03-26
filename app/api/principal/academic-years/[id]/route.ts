import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { NextResponse } from "next/server";

export async function PUT(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  const year = await db.academicYear.update({
    where: { id },
    data: {
      name: body.name,
      startDate: new Date(body.startDate),
      endDate: new Date(body.endDate),
      isCurrent: body.isCurrent ?? false,
    },
  });

  return NextResponse.json({ year });
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  await db.academicYear.delete({ where: { id } });
  return NextResponse.json({ success: true });
}
