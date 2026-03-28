import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import type { Prisma } from "@/app/generated/prisma/client";
import type { StudentStatus } from "@/app/generated/prisma/enums";
import { sendEmail, buildStudentWelcomeEmail } from "@/lib/email";
import { generateTemporaryPassword } from "@/lib/password";
import { getLoginPageUrl } from "@/lib/app-url";
import { NextResponse } from "next/server";

/** Node runtime: full process.env (Vercel secrets) — Edge would not expose all server env vars. */
export const runtime = "nodejs";

export async function GET(req: Request) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const q = searchParams.get("q")?.trim();
  const programId = searchParams.get("programId") || undefined;
  const batchId = searchParams.get("batchId") || undefined;
  const status = searchParams.get("status") || undefined;
  const teacherId = searchParams.get("teacherId") || undefined;

  const and: Prisma.UserWhereInput[] = [{ role: "STUDENT" }];

  if (q) {
    and.push({
      OR: [
        { firstName: { contains: q, mode: "insensitive" } },
        { lastName: { contains: q, mode: "insensitive" } },
        { email: { contains: q, mode: "insensitive" } },
        { studentProfile: { is: { enrollmentNo: { contains: q, mode: "insensitive" } } } },
      ],
    });
  }

  const sp: Prisma.StudentProfileWhereInput = {};
  if (programId) sp.programId = programId;
  if (batchId) sp.batchId = batchId;
  if (status) sp.status = status as StudentStatus;
  if (teacherId) {
    sp.batch = {
      teacherAssignments: {
        some: { teacherProfile: { userId: teacherId } },
      },
    };
  }
  if (Object.keys(sp).length > 0) {
    and.push({ studentProfile: { is: sp } });
  }

  const students = await db.user.findMany({
    where: { AND: and },
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
          // ACCEPTED = invited via portal; becomes ENROLLED after first password change (see change-password API)
          status: body.status ?? "ACCEPTED",
        },
      },
    },
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
    subject: emailPayload.subject,
    html: emailPayload.html,
    text: emailPayload.text,
  });

  const welcomeEmailStatus = !emailResult.ok ? "failed" : emailResult.mock ? "mock" : "sent";

  return NextResponse.json({
    user: { id: user.id, email: user.email },
    welcomeEmailStatus,
    emailError: !emailResult.ok ? emailResult.error : undefined,
  });
}
