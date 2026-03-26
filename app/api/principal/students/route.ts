import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { NextResponse } from "next/server";

export async function GET() {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const students = await db.user.findMany({
    where: { role: "STUDENT" },
    include: {
      studentProfile: { include: { program: true, batch: true } },
      attempts: { where: { status: "GRADED" }, select: { percentage: true } },
      attendanceRecords: { select: { status: true } },
    },
    orderBy: { firstName: "asc" },
  });

  return NextResponse.json({ students });
}

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  const bcrypt = await import("bcryptjs");
  const hashedPassword = await bcrypt.hash(body.password || "Student@123", 10);

  const user = await db.user.create({
    data: {
      email: body.email,
      firstName: body.firstName,
      lastName: body.lastName,
      middleName: body.middleName || null,
      phone: body.phone || null,
      hashedPassword,
      role: "STUDENT",
      studentProfile: {
        create: {
          enrollmentNo: body.enrollmentNo || `STU-${Date.now()}`,
          programId: body.programId || null,
          batchId: body.batchId || null,
          status: body.status || "ACTIVE",
        },
      },
    },
  });

  return NextResponse.json({ user });
}
