import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { deleteStudentUserCascade } from "@/lib/delete-student-user";
import { deleteStaffUserCascade } from "@/lib/delete-staff-user";
import { hasPrincipalPortalAccess } from "@/lib/portal-access";
import { NextResponse } from "next/server";

export const runtime = "nodejs";

// ── GET /api/principal/users/[id] ────────────────────────────────────────────
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!hasPrincipalPortalAccess(session)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const user = await db.user.findUnique({
    where: { id },
    select: {
      id: true,
      firstName: true,
      middleName: true,
      lastName: true,
      email: true,
      phone: true,
      address: true,
      city: true,
      state: true,
      country: true,
      postalCode: true,
      visaStatus: true,
      role: true,
      isActive: true,
      profilePicture: true,
      createdAt: true,
      studentProfile: {
        select: { enrollmentNo: true, status: true, programId: true, batchId: true },
      },
      teacherProfile: {
        select: { employeeId: true, department: true, specialization: true, qualification: true },
      },
    },
  });

  if (!user) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json({ user });
}

// ── PUT /api/principal/users/[id] ────────────────────────────────────────────
export async function PUT(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!hasPrincipalPortalAccess(session)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const body = await req.json() as Record<string, unknown>;
  const str = (k: string) => (typeof body[k] === "string" ? (body[k] as string).trim() || null : undefined);

  const existing = await db.user.findUnique({ where: { id }, select: { id: true, role: true } });
  if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });

  // Prevent principal from deactivating themselves
  if (id === session.user.id && body.isActive === false) {
    return NextResponse.json({ error: "You cannot deactivate your own account." }, { status: 400 });
  }

  let nextEmail: string | undefined;
  if (typeof body.email === "string") {
    nextEmail = body.email.trim().toLowerCase();
    if (!nextEmail) {
      return NextResponse.json({ error: "Email cannot be empty." }, { status: 400 });
    }
    const taken = await db.user.findFirst({
      where: { email: nextEmail, NOT: { id } },
      select: { id: true },
    });
    if (taken) {
      return NextResponse.json({ error: "That email is already in use by another account." }, { status: 409 });
    }
  }

  await db.user.update({
    where: { id },
    data: {
      ...(nextEmail !== undefined && { email: nextEmail }),
      ...(body.firstName !== undefined && { firstName: body.firstName as string }),
      ...(body.lastName !== undefined && { lastName: body.lastName as string }),
      ...(str("middleName") !== undefined && { middleName: str("middleName") }),
      ...(str("phone") !== undefined && { phone: str("phone") }),
      ...(str("address") !== undefined && { address: str("address") }),
      ...(str("city") !== undefined && { city: str("city") }),
      ...(str("state") !== undefined && { state: str("state") }),
      ...(str("country") !== undefined && { country: str("country") }),
      ...(str("postalCode") !== undefined && { postalCode: str("postalCode") }),
      ...(str("visaStatus") !== undefined && { visaStatus: str("visaStatus") }),
      ...(body.isActive !== undefined && { isActive: Boolean(body.isActive) }),
    },
  });

  if (existing.role === "TEACHER" && (body.employeeId !== undefined || body.department !== undefined || body.specialization !== undefined)) {
    const profile = await db.teacherProfile.findUnique({ where: { userId: id } });
    if (profile) {
      await db.teacherProfile.update({
        where: { id: profile.id },
        data: {
          ...(body.employeeId !== undefined && { employeeId: body.employeeId as string }),
          ...(str("department") !== undefined && { department: str("department") }),
          ...(str("specialization") !== undefined && { specialization: str("specialization") }),
          ...(str("qualification") !== undefined && { qualification: str("qualification") }),
        },
      });
    }
  }

  if (existing.role === "STUDENT" && (body.enrollmentNo !== undefined || body.programId !== undefined || body.batchId !== undefined)) {
    const profile = await db.studentProfile.findUnique({ where: { userId: id } });
    if (profile) {
      await db.studentProfile.update({
        where: { userId: id },
        data: {
          ...(body.enrollmentNo !== undefined && { enrollmentNo: body.enrollmentNo as string }),
          ...(body.programId !== undefined && { programId: (body.programId as string) || null }),
          ...(body.batchId !== undefined && { batchId: (body.batchId as string) || null }),
        },
      });
    }
  }

  return NextResponse.json({ ok: true });
}

// ── DELETE /api/principal/users/[id] — permanent removal (students only) ─────
export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!hasPrincipalPortalAccess(session)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  if (id === session.user.id) {
    return NextResponse.json({ error: "You cannot delete your own account." }, { status: 400 });
  }

  const user = await db.user.findUnique({ where: { id }, select: { id: true, role: true } });
  if (!user) return NextResponse.json({ error: "Not found" }, { status: 404 });

  try {
    if (user.role === "STUDENT") {
      await deleteStudentUserCascade(id);
    } else {
      await deleteStaffUserCascade(id, session.user.id);
    }
  } catch (e) {
    console.error("delete user", e);
    const message =
      e instanceof Error ? e.message : "Could not delete this user. Resolve related records and try again.";
    return NextResponse.json({ error: message }, { status: 400 });
  }

  return NextResponse.json({ ok: true });
}
