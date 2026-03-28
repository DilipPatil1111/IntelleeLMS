import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import type { Prisma } from "@/app/generated/prisma/client";
import { sendEmail, buildStudentWelcomeEmail } from "@/lib/email";
import { generateTemporaryPassword } from "@/lib/password";
import { getLoginPageUrl } from "@/lib/app-url";
import { NextResponse } from "next/server";

export const runtime = "nodejs";

export async function GET(req: Request) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const q = searchParams.get("q")?.trim();
  const programId = searchParams.get("programId") || undefined;

  const and: Prisma.UserWhereInput[] = [{ role: "TEACHER" }];
  if (q) {
    and.push({
      OR: [
        { firstName: { contains: q, mode: "insensitive" } },
        { lastName: { contains: q, mode: "insensitive" } },
        { email: { contains: q, mode: "insensitive" } },
        { teacherProfile: { is: { employeeId: { contains: q, mode: "insensitive" } } } },
      ],
    });
  }
  if (programId) {
    and.push({
      teacherProfile: { is: { teacherPrograms: { some: { programId } } } },
    });
  }

  const teachers = await db.user.findMany({
    where: { AND: and },
    include: {
      teacherProfile: {
        include: {
          subjectAssignments: { include: { subject: true, batch: true } },
          teacherPrograms: { include: { program: true } },
        },
      },
    },
    orderBy: { firstName: "asc" },
  });

  return NextResponse.json({ teachers });
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

  const count = await db.teacherProfile.count();
  const employeeId = body.employeeId || `TCH${String(count + 1).padStart(6, "0")}`;

  const programIds: string[] = Array.isArray(body.programIds) ? body.programIds : [];

  const user = await db.user.create({
    data: {
      email: body.email,
      firstName: body.firstName,
      lastName: body.lastName,
      middleName: body.middleName || null,
      phone: body.phone || null,
      hashedPassword,
      mustChangePassword: true,
      role: "TEACHER",
      teacherProfile: {
        create: {
          employeeId,
          department: body.department || null,
          qualification: body.qualification || null,
          specialization: body.specialization || null,
          teacherPrograms: {
            create: programIds.map((programId) => ({ programId })),
          },
        },
      },
    },
    include: { teacherProfile: { include: { teacherPrograms: { include: { program: true } } } } },
  });

  const loginUrl = getLoginPageUrl();
  const emailPayload = buildStudentWelcomeEmail({
    firstName: user.firstName,
    email: user.email,
    temporaryPassword: plainPassword,
    loginUrl,
  });
  const emailResult = await sendEmail({
    to: user.email,
    subject: "Your Intellee College teacher account",
    html: emailPayload.html.replace("student account", "teacher account"),
    text: emailPayload.text.replace("student account", "teacher account"),
  });

  const welcomeEmailStatus = !emailResult.ok ? "failed" : emailResult.mock ? "mock" : "sent";

  return NextResponse.json({
    user: { id: user.id, email: user.email },
    welcomeEmailStatus,
    emailError: !emailResult.ok ? emailResult.error : undefined,
  });
}
