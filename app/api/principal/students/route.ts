import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { sendEmail, buildStudentWelcomeEmail } from "@/lib/email";
import { generateTemporaryPassword } from "@/lib/password";
import { env } from "@/lib/env";
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
  const plainPassword =
    typeof body.password === "string" && body.password.length >= 8
      ? body.password
      : generateTemporaryPassword();
  const hashedPassword = await bcrypt.hash(plainPassword, 12);

  const user = await db.user.create({
    data: {
      email: body.email,
      firstName: body.firstName,
      lastName: body.lastName,
      middleName: body.middleName || null,
      phone: body.phone || null,
      hashedPassword,
      mustChangePassword: true,
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

  const loginUrl = `${env.NEXT_PUBLIC_APP_URL.replace(/\/$/, "")}/login`;
  const emailPayload = buildStudentWelcomeEmail({
    firstName: user.firstName,
    email: user.email,
    temporaryPassword: plainPassword,
    loginUrl,
  });
  await sendEmail({
    to: user.email,
    subject: emailPayload.subject,
    html: emailPayload.html,
    text: emailPayload.text,
  });

  return NextResponse.json({ user: { id: user.id, email: user.email } });
}
