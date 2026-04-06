import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import type { Prisma } from "@/app/generated/prisma/client";
import type { StudentStatus } from "@/app/generated/prisma/enums";
import { buildStudentWelcomeEmail } from "@/lib/email";
import { sendEmailWithSignature } from "@/lib/email-signature";
import { generateTemporaryPassword } from "@/lib/password";
import { getLoginPageUrl, getServerAppUrl } from "@/lib/app-url";
import { principalStudentSearchAndClauses } from "@/lib/principal-student-search";
import { mapStudentStatusToApplicationStatus } from "@/lib/sync-program-applications";
import { hasPrincipalPortalAccess } from "@/lib/portal-access";
import { NextResponse } from "next/server";

/** Node runtime: full process.env (Vercel secrets) — Edge would not expose all server env vars. */
export const runtime = "nodejs";

export async function GET(req: Request) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!hasPrincipalPortalAccess(session)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { searchParams } = new URL(req.url);
  const q = searchParams.get("q")?.trim();
  const studentId = searchParams.get("studentId")?.trim();
  const programId = searchParams.get("programId") || undefined;
  const batchId = searchParams.get("batchId") || undefined;
  const status = searchParams.get("status") || undefined;
  const teacherId = searchParams.get("teacherId") || undefined;

  const and: Prisma.UserWhereInput[] = [{ role: "STUDENT" }];

  if (studentId) {
    and.push({ id: studentId });
  }

  if (q) {
    and.push(...principalStudentSearchAndClauses(q));
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

  return NextResponse.json(
    { students },
    {
      headers: {
        "Cache-Control": "no-store, no-cache, must-revalidate, max-age=0",
      },
    }
  );
}

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!hasPrincipalPortalAccess(session)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const body = await req.json();
  const bcrypt = await import("bcryptjs");
  const plainPassword =
    typeof body.password === "string" && body.password.length >= 8
      ? body.password
      : generateTemporaryPassword();
  const hashedPassword = await bcrypt.hash(plainPassword, 12);

  const email = typeof body.email === "string" ? body.email.trim() : "";
  const existing = await db.user.findUnique({ where: { email } });
  if (existing) {
    return NextResponse.json(
      {
        error:
          "This email is already registered. Use a different email for each person — a teacher account cannot share an email with a student.",
      },
      { status: 409 }
    );
  }

  const spStatus = (body.status as StudentStatus | undefined) ?? "ACCEPTED";

  const user = await db.$transaction(async (tx) => {
    const u = await tx.user.create({
      data: {
        email,
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
            enrollmentDate: new Date(),
            status: spStatus,
          },
        },
        studentOnboarding: { create: {} },
      },
    });

    if (body.programId) {
      const snap = await tx.program.findUnique({
        where: { id: body.programId },
        select: {
          programDomainId: true,
          programCategoryId: true,
          programTypeId: true,
        },
      });
      await tx.programApplication.create({
        data: {
          applicantId: u.id,
          programId: body.programId,
          batchId: body.batchId || null,
          status: mapStudentStatusToApplicationStatus(spStatus),
          programDomainId: snap?.programDomainId ?? null,
          programCategoryId: snap?.programCategoryId ?? null,
          programTypeId: snap?.programTypeId ?? null,
        },
      });

      if (["ENROLLED", "COMPLETED", "GRADUATED"].includes(spStatus)) {
        await tx.programEnrollment.create({
          data: {
            userId: u.id,
            programId: body.programId,
            batchId: body.batchId || null,
            status: spStatus,
            enrollmentNo: body.enrollmentNo || `STU-${Date.now()}`,
            enrollmentDate: new Date(),
          },
        });
      }
    }

    return u;
  });

  const loginUrl = getLoginPageUrl();
  const base = getServerAppUrl().replace(/\/$/, "");
  const onboardingUrl = `${base}/student/onboarding`;
  const emailPayload = buildStudentWelcomeEmail({
    firstName: user.firstName,
    email: user.email,
    temporaryPassword: plainPassword,
    loginUrl,
    onboardingUrl,
  });
  const emailResult = await sendEmailWithSignature({
    to: user.email,
    subject: emailPayload.subject,
    html: emailPayload.html,
    text: emailPayload.text,
    senderUserId: session.user.id,
  });

  const welcomeEmailStatus = !emailResult.ok ? "failed" : emailResult.mock ? "mock" : "sent";

  return NextResponse.json({
    user: { id: user.id, email: user.email },
    welcomeEmailStatus,
    emailError: !emailResult.ok ? emailResult.error : undefined,
  });
}
