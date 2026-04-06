import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { deleteStudentUserCascade } from "@/lib/delete-student-user";
import {
  buildProfileStatusData,
  isValidStudentStatus,
  notifyStudentStatusChange,
} from "@/lib/student-status";
import { sendGraduationCertificateEmail } from "@/lib/graduation-certificate";
import { sendStudentProgramBatchChangeEmail } from "@/lib/student-status-email";
import { syncProgramApplicationsWithProfileEnrolled } from "@/lib/sync-enrollment-status";
import type { SuspensionReason } from "@/app/generated/prisma/enums";
import { hasPrincipalPortalAccess } from "@/lib/portal-access";
import { NextResponse } from "next/server";

export async function PUT(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  if (!hasPrincipalPortalAccess(session)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await req.json();

  const existing = await db.studentProfile.findUnique({ where: { userId: id } });
  const prevStatus = existing?.status;
  const prevProgramId = existing?.programId ?? null;
  const prevBatchId = existing?.batchId ?? null;

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

      const mergedProgramId =
        body.programId !== undefined ? body.programId || null : existing.programId ?? null;

      await db.studentProfile.update({
        where: { userId: id },
        data: {
          ...(body.programId !== undefined && { programId: body.programId || null }),
          ...(body.batchId !== undefined && { batchId: body.batchId || null }),
          ...buildProfileStatusData(next, { suspensionReason: suspensionReason ?? null, statusNote }),
          ...(prevStatus === "GRADUATED" && next !== "GRADUATED" ? { graduationCertificateSentAt: null } : {}),
        },
      });

      if (next === "ENROLLED" && mergedProgramId) {
        const updatedProfile = await db.studentProfile.findUnique({
          where: { userId: id },
          select: { batchId: true, enrollmentNo: true },
        });
        await db.programEnrollment.upsert({
          where: { userId_programId: { userId: id, programId: mergedProgramId } },
          update: { status: "ENROLLED", batchId: updatedProfile?.batchId ?? null },
          create: {
            userId: id,
            programId: mergedProgramId,
            batchId: updatedProfile?.batchId ?? null,
            status: "ENROLLED",
            enrollmentNo: updatedProfile?.enrollmentNo,
            enrollmentDate: new Date(),
          },
        });
        await syncProgramApplicationsWithProfileEnrolled(id, mergedProgramId);
      } else if (next === "ENROLLED") {
        await syncProgramApplicationsWithProfileEnrolled(id, mergedProgramId);
      }

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
      const nextProf = await db.studentProfile.findUnique({
        where: { userId: id },
        include: { program: true, batch: true },
      });
      const userRow = await db.user.findUnique({ where: { id }, select: { email: true, firstName: true } });
      if (
        userRow?.email &&
        (prevProgramId !== nextProf?.programId || prevBatchId !== nextProf?.batchId)
      ) {
        await sendStudentProgramBatchChangeEmail({
          to: userRow.email,
          firstName: userRow.firstName,
          programName: nextProf?.program?.name ?? null,
          batchName: nextProf?.batch?.name ?? null,
          enrollmentNo: nextProf?.enrollmentNo ?? null,
        });
      }
    }
  }

  return NextResponse.json({ success: true });
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  if (!hasPrincipalPortalAccess(session)) {
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
