import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { NextResponse } from "next/server";

export async function PUT(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();

  await db.user.update({
    where: { id },
    data: {
      firstName: body.firstName,
      lastName: body.lastName,
      middleName: body.middleName || null,
      phone: body.phone || null,
      email: body.email,
      isActive: body.isActive ?? true,
    },
  });

  if (body.programId !== undefined || body.batchId !== undefined || body.status !== undefined) {
    await db.studentProfile.update({
      where: { userId: id },
      data: {
        ...(body.programId !== undefined && { programId: body.programId || null }),
        ...(body.batchId !== undefined && { batchId: body.batchId || null }),
        ...(body.status !== undefined && { status: body.status }),
      },
    });
  }

  return NextResponse.json({ success: true });
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  await db.studentProfile.deleteMany({ where: { userId: id } });
  await db.user.delete({ where: { id } });
  return NextResponse.json({ success: true });
}
