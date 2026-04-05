import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { Prisma } from "@/app/generated/prisma/client";
import { buildPrincipalTeacherInviteEmail } from "@/lib/email";
import { sendEmailWithSignature } from "@/lib/email-signature";
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
  const assignment = searchParams.get("assignment") || undefined;

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
      OR: [
        { teacherProfile: { is: { teacherPrograms: { some: { programId } } } } },
        { teacherProfile: { is: { teacherPrograms: { none: {} } } } },
        { teacherProfile: null },
      ],
    });
  }
  if (assignment === "unassigned") {
    and.push({
      OR: [
        { teacherProfile: null },
        { teacherProfile: { is: { subjectAssignments: { none: {} } } } },
      ],
    });
  } else if (assignment === "assigned") {
    and.push({ teacherProfile: { is: { subjectAssignments: { some: {} } } } });
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

function parseSubjectAssignments(raw: unknown): { subjectId: string; batchId: string }[] {
  if (!Array.isArray(raw)) return [];
  const out: { subjectId: string; batchId: string }[] = [];
  const seen = new Set<string>();
  for (const row of raw) {
    if (!row || typeof row !== "object") continue;
    const subjectId = (row as { subjectId?: string }).subjectId;
    const batchId = (row as { batchId?: string }).batchId;
    if (!subjectId || !batchId) continue;
    const k = `${subjectId}:${batchId}`;
    if (seen.has(k)) continue;
    seen.add(k);
    out.push({ subjectId, batchId });
  }
  return out;
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

  const programIds: string[] = Array.isArray(body.programIds) ? body.programIds.filter(Boolean) : [];
  const subjectAssignments = parseSubjectAssignments(body.subjectAssignments);

  for (const row of subjectAssignments) {
    const [subject, batch] = await Promise.all([
      db.subject.findUnique({ where: { id: row.subjectId } }),
      db.batch.findUnique({ where: { id: row.batchId } }),
    ]);
    if (!subject || !batch || subject.programId !== batch.programId) {
      return NextResponse.json(
        {
          error:
            "Invalid subject/batch pair: each subject must belong to the same program as the batch. Remove invalid rows and try again.",
        },
        { status: 400 }
      );
    }
    if (!programIds.includes(subject.programId)) {
      programIds.push(subject.programId);
    }
  }

  const existing = await db.user.findUnique({ where: { email: body.email?.trim() } });
  if (existing) {
    return NextResponse.json(
      { error: "This email is already in use. Teachers must use a unique email (not shared with a student account)." },
      { status: 409 }
    );
  }

  let user;
  try {
    user = await db.$transaction(async (tx) => {
      const u = await tx.user.create({
        data: {
          email: body.email?.trim(),
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
              teacherPrograms:
                programIds.length > 0
                  ? { create: programIds.map((pid: string) => ({ programId: pid })) }
                  : undefined,
            },
          },
        },
        include: {
          teacherProfile: {
            include: { teacherPrograms: { include: { program: true } } },
          },
        },
      });

      const tpId = u.teacherProfile?.id;
      if (tpId && subjectAssignments.length > 0) {
        await tx.teacherSubjectAssignment.createMany({
          data: subjectAssignments.map((r) => ({
            teacherProfileId: tpId,
            subjectId: r.subjectId,
            batchId: r.batchId,
          })),
        });
      }

      return u;
    });
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") {
      return NextResponse.json(
        { error: "Duplicate email or employee ID. Use a different email or employee ID." },
        { status: 409 }
      );
    }
    throw e;
  }

  const loginUrl = getLoginPageUrl();

  let assignmentLines: { programName: string; batchName: string; subjectName: string }[] = [];
  if (user.teacherProfile?.id) {
    const rows = await db.teacherSubjectAssignment.findMany({
      where: { teacherProfileId: user.teacherProfile.id },
      include: { subject: true, batch: { include: { program: true } } },
    });
    assignmentLines = rows.map((r) => ({
      programName: r.batch.program.name,
      batchName: r.batch.name,
      subjectName: r.subject.name,
    }));
  }

  const emailPayload = buildPrincipalTeacherInviteEmail({
    firstName: user.firstName,
    email: user.email,
    temporaryPassword: plainPassword,
    loginUrl,
    assignmentLines,
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
