import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { NextResponse } from "next/server";

export async function PUT(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  const holiday = await db.holiday.update({
    where: { id },
    data: {
      name: body.name,
      date: new Date(body.date),
      type: body.type || "PUBLIC",
      academicYearId: body.academicYearId || null,
    },
  });

  return NextResponse.json({ holiday });
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  await db.holiday.delete({ where: { id } });
  return NextResponse.json({ success: true });
}
