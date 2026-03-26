import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { NextResponse } from "next/server";

export async function PUT(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  const durationText = typeof body.durationText === "string" ? body.durationText.trim() : "";
  const program = await db.program.update({
    where: { id },
    data: {
      name: body.name,
      code: body.code,
      description: body.description || null,
      durationYears: typeof body.durationYears === "number" ? body.durationYears : 1,
      durationText: durationText || null,
    },
  });

  return NextResponse.json({ program });
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  await db.program.delete({ where: { id } });
  return NextResponse.json({ success: true });
}
