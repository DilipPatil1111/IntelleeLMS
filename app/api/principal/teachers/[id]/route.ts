import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { NextResponse } from "next/server";

export async function PUT(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  const user = await db.user.findUnique({
    where: { id, role: "TEACHER" },
    include: { teacherProfile: true },
  });
  if (!user?.teacherProfile) return NextResponse.json({ error: "Not found" }, { status: 404 });

  await db.user.update({
    where: { id },
    data: {
      firstName: body.firstName,
      lastName: body.lastName,
      middleName: body.middleName ?? undefined,
      phone: body.phone ?? undefined,
      email: body.email,
      isActive: body.isActive ?? true,
    },
  });

  await db.teacherProfile.update({
    where: { id: user.teacherProfile.id },
    data: {
      employeeId: body.employeeId,
      department: body.department ?? undefined,
      qualification: body.qualification ?? undefined,
      specialization: body.specialization ?? undefined,
    },
  });

  if (Array.isArray(body.programIds)) {
    await db.teacherProgram.deleteMany({ where: { teacherProfileId: user.teacherProfile.id } });
    if (body.programIds.length > 0) {
      await db.teacherProgram.createMany({
        data: body.programIds.map((programId: string) => ({
          teacherProfileId: user.teacherProfile!.id,
          programId,
        })),
        skipDuplicates: true,
      });
    }
  }

  return NextResponse.json({ success: true });
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const user = await db.user.findUnique({ where: { id, role: "TEACHER" } });
  if (!user) return NextResponse.json({ error: "Not found" }, { status: 404 });

  await db.user.update({ where: { id }, data: { isActive: false } });

  return NextResponse.json({ success: true });
}
