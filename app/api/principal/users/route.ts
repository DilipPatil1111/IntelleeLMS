import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { hasPrincipalPortalAccess } from "@/lib/portal-access";
import { generateTemporaryPassword } from "@/lib/password";
import { NextResponse } from "next/server";
import type { Prisma, Role } from "@/app/generated/prisma/client";

export const runtime = "nodejs";

const ALLOWED_ROLES: Role[] = ["STUDENT", "TEACHER", "PRINCIPAL"];

// ── GET /api/principal/users ─────────────────────────────────────────────────
export async function GET(req: Request) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!hasPrincipalPortalAccess(session)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { searchParams } = new URL(req.url);
  const q = searchParams.get("q")?.trim();
  const role = searchParams.get("role") as Role | null;
  const isActive = searchParams.get("isActive");

  const and: Prisma.UserWhereInput[] = [];

  if (role && ALLOWED_ROLES.includes(role)) {
    and.push({ role });
  } else {
    and.push({ role: { in: ALLOWED_ROLES } });
  }

  if (isActive === "true") and.push({ isActive: true });
  if (isActive === "false") and.push({ isActive: false });

  if (q) {
    and.push({
      OR: [
        { firstName: { contains: q, mode: "insensitive" } },
        { lastName: { contains: q, mode: "insensitive" } },
        { email: { contains: q, mode: "insensitive" } },
        { phone: { contains: q, mode: "insensitive" } },
      ],
    });
  }

  const users = await db.user.findMany({
    where: { AND: and },
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
      studentProfile: { select: { enrollmentNo: true, status: true, programId: true, batchId: true } },
      teacherProfile: { select: { employeeId: true, department: true, specialization: true } },
    },
    orderBy: [{ role: "asc" }, { firstName: "asc" }],
  });

  return NextResponse.json({ users });
}

// ── POST /api/principal/users ────────────────────────────────────────────────
export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!hasPrincipalPortalAccess(session)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const body = await req.json() as Record<string, unknown>;
  const bcrypt = await import("bcryptjs");

  const email = typeof body.email === "string" ? body.email.trim().toLowerCase() : "";
  const firstName = typeof body.firstName === "string" ? body.firstName.trim() : "";
  const lastName = typeof body.lastName === "string" ? body.lastName.trim() : "";
  const role = (typeof body.role === "string" ? body.role.toUpperCase() : "STUDENT") as Role;

  if (!email) return NextResponse.json({ error: "Email is required." }, { status: 400 });
  if (!firstName || !lastName) return NextResponse.json({ error: "First name and last name are required." }, { status: 400 });
  if (!ALLOWED_ROLES.includes(role)) return NextResponse.json({ error: "Invalid role." }, { status: 400 });

  const existing = await db.user.findUnique({ where: { email } });
  if (existing) return NextResponse.json({ error: "A user with this email already exists." }, { status: 409 });

  const plainPassword =
    typeof body.password === "string" && body.password.length >= 8
      ? body.password
      : generateTemporaryPassword();
  const hashedPassword = await bcrypt.hash(plainPassword, 12);

  type UserCreateData = Prisma.UserCreateInput;

  const data: UserCreateData = {
    email,
    firstName,
    lastName,
    middleName: typeof body.middleName === "string" && body.middleName.trim() ? body.middleName.trim() : null,
    phone: typeof body.phone === "string" && body.phone.trim() ? body.phone.trim() : null,
    hashedPassword,
    mustChangePassword: true,
    role,
    isActive: true,
  };

  if (role === "STUDENT") {
    const count = await db.studentProfile.count();
    data.studentProfile = {
      create: {
        enrollmentNo: typeof body.enrollmentNo === "string" && body.enrollmentNo.trim()
          ? body.enrollmentNo.trim()
          : `STU-${String(count + 1).padStart(6, "0")}`,
        programId: typeof body.programId === "string" ? body.programId || null : null,
        batchId: typeof body.batchId === "string" ? body.batchId || null : null,
        enrollmentDate: new Date(),
        status: "ACCEPTED",
      },
    };
    data.studentOnboarding = { create: {} };
  } else if (role === "TEACHER") {
    const count = await db.teacherProfile.count();
    data.teacherProfile = {
      create: {
        employeeId: typeof body.employeeId === "string" && body.employeeId.trim()
          ? body.employeeId.trim()
          : `TCH${String(count + 1).padStart(6, "0")}`,
        department: typeof body.department === "string" ? body.department.trim() || null : null,
        specialization: typeof body.specialization === "string" ? body.specialization.trim() || null : null,
      },
    };
  }

  const user = await db.user.create({ data, select: { id: true, email: true, firstName: true, lastName: true, role: true } });

  return NextResponse.json({ ok: true, user, temporaryPassword: plainPassword }, { status: 201 });
}
