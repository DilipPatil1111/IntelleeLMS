import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { NextResponse } from "next/server";

export const runtime = "nodejs";

/** GET /api/user/profile — return the current user's editable profile data */
export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let user;
  try {
    user = await db.user.findUnique({
    where: { id: session.user.id },
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
      profilePicture: true,
      role: true,
      createdAt: true,
      studentProfile: {
        select: {
          enrollmentNo: true,
          status: true,
          program: { select: { name: true } },
          batch: {
            select: {
              name: true,
              academicYear: { select: { name: true } },
            },
          },
        },
      },
      teacherProfile: {
        select: {
          specialization: true,
          qualification: true,
          joinDate: true,
          teacherPrograms: {
            select: { program: { select: { name: true } } },
          },
        },
      },
    },
  });
  } catch (e) {
    console.error("GET /api/user/profile", e);
    return NextResponse.json(
      { error: "Could not load profile. If this persists, contact support." },
      { status: 500 }
    );
  }

  if (!user) return NextResponse.json({ error: "User not found" }, { status: 404 });

  return NextResponse.json({ user });
}

/** PUT /api/user/profile — update editable fields for the current user */
export async function PUT(req: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json().catch(() => ({})) as Record<string, unknown>;

  const str = (key: string) => {
    const v = body[key];
    return typeof v === "string" ? v.trim() || null : undefined;
  };

  // firstName and lastName are required when provided
  const firstName = str("firstName");
  const lastName = str("lastName");
  if (firstName === null) return NextResponse.json({ error: "First name is required" }, { status: 400 });
  if (lastName === null) return NextResponse.json({ error: "Last name is required" }, { status: 400 });

  const data: Record<string, unknown> = {};
  if (firstName !== undefined) data.firstName = firstName;
  if (lastName !== undefined) data.lastName = lastName;

  const optionalFields = ["middleName", "phone", "address", "city", "state", "country", "postalCode", "visaStatus"] as const;
  for (const f of optionalFields) {
    const v = str(f);
    if (v !== undefined) data[f] = v;
  }

  if (Object.keys(data).length === 0) {
    return NextResponse.json({ error: "No fields to update" }, { status: 400 });
  }

  const updated = await db.user.update({
    where: { id: session.user.id },
    data,
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
      profilePicture: true,
      role: true,
    },
  });

  return NextResponse.json({ ok: true, user: updated });
}
