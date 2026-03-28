import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { deleteStudentUserCascade } from "@/lib/delete-student-user";
import {
  buildProfileStatusData,
  isValidStudentStatus,
  notifyStudentStatusChange,
} from "@/lib/student-status";
import { sendGraduationCertificateEmail } from "@/lib/graduation-certificate";
import type { SuspensionReason } from "@/app/generated/prisma/enums";
import { NextResponse } from "next/server";

export async function PUT(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();

  const existing = await db.studentProfile.findUnique({ where: { userId: id } });
  const prevStatus = existing?.status;

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
    if (body.status !== undefined) {
      if (!existing) {
        return NextResponse.json({ error: "Student not found" }, { status: 404 });
      }
      if (!isValidStudentStatus(body.status)) {
        return NextResponse.json({ error: "Invalid student status" }, { status: 400 });
      }
      const next = body.status;
      const suspensionReason =
        typeof body.suspensionReason === "string"
          ? (body.suspensionReason as SuspensionReason)
          : undefined;
      const statusNote = typeof body.statusNote === "string" ? body.statusNote : undefined;
      const noteTrim = statusNote?.trim() ?? "";

      if (next === "SUSPENDED" && !suspensionReason) {
        return NextResponse.json(
          { error: "suspensionReason is required when status is SUSPENDED (FEES, ATTENDANCE, ACADEMIC, or OTHER)." },
          { status: 400 }
        );
      }

      if ((next === "EXPELLED" || next === "TRANSFERRED") && noteTrim.length < 10) {
        return NextResponse.json(
          {
            error:
              next === "EXPELLED"
                ? "Provide details (at least 10 characters) for expulsion: non-compliance, policy violated, and any other context for the student notification."
                : "Provide details (at least 10 characters) for transfer: destination college/institution and any other context.",
          },
          { status: 400 }
        );
      }

      await db.studentProfile.update({
        where: { userId: id },
        data: {
          ...(body.programId !== undefined && { programId: body.programId || null }),
          ...(body.batchId !== undefined && { batchId: body.batchId || null }),
          ...buildProfileStatusData(next, { suspensionReason: suspensionReason ?? null, statusNote }),
          ...(prevStatus === "GRADUATED" && next !== "GRADUATED" ? { graduationCertificateSentAt: null } : {}),
        },
      });

      if (prevStatus && prevStatus !== next) {
        await notifyStudentStatusChange(id, prevStatus, next, {
          suspensionReason: suspensionReason ?? null,
          statusNote: statusNote ?? null,
        });
        if (next === "GRADUATED" && prevStatus !== "GRADUATED") {
          await sendGraduationCertificateEmail(id);
        }
      }
    } else {
      await db.studentProfile.update({
        where: { userId: id },
        data: {
          ...(body.programId !== undefined && { programId: body.programId || null }),
          ...(body.batchId !== undefined && { batchId: body.batchId || null }),
        },
      });
    }
  }

  return NextResponse.json({ success: true });
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const principal = await db.user.findUnique({
    where: { id: session.user.id },
    select: { role: true },
  });
  if (principal?.role !== "PRINCIPAL") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const target = await db.user.findUnique({
    where: { id },
    select: { role: true },
  });
  if (!target) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (target.role !== "STUDENT") {
    return NextResponse.json({ error: "Only student accounts can be deleted here." }, { status: 400 });
  }

  try {
    await deleteStudentUserCascade(id);
  } catch (e) {
    console.error("deleteStudentUserCascade", e);
    return NextResponse.json(
      {
        error:
          e instanceof Error
            ? e.message
            : "Could not delete student. Close related records and try again, or contact support.",
      },
      { status: 500 }
    );
  }

  return NextResponse.json({ success: true });
}
