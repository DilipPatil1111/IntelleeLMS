import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { isHolidayType } from "@/lib/holiday-types";
import { hasPrincipalPortalAccess } from "@/lib/portal-access";
import { NextResponse } from "next/server";
import type { HolidayType } from "@/app/generated/prisma/enums";

export async function PUT(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!hasPrincipalPortalAccess(session)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const body = await req.json();
  const rawType = typeof body.type === "string" ? body.type.trim() : "";
  if (rawType && !isHolidayType(rawType)) {
    return NextResponse.json({ error: "Invalid holiday type" }, { status: 400 });
  }
  const type: HolidayType = rawType && isHolidayType(rawType) ? rawType : "PUBLIC";

  const holiday = await db.holiday.update({
    where: { id },
    data: {
      name: body.name,
      date: new Date(body.date),
      type,
      academicYearId: body.academicYearId || null,
    },
  });

  return NextResponse.json({ holiday });
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!hasPrincipalPortalAccess(session)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  await db.holiday.delete({ where: { id } });
  return NextResponse.json({ success: true });
}
