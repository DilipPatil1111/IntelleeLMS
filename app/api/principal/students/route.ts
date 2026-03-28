import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { sendEmail, buildStudentWelcomeEmail } from "@/lib/email";
import { generateTemporaryPassword } from "@/lib/password";
import { getLoginPageUrl } from "@/lib/app-url";
import { NextResponse } from "next/server";

/** Node runtime: full process.env (Vercel secrets) — Edge would not expose all server env vars. */
export const runtime = "nodejs";

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
