import type { Session } from "next-auth";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { hasPrincipalPortalAccess } from "@/lib/portal-access";
import { NextResponse } from "next/server";
import { slotDurationMinutes } from "@/lib/program-calendar-hours";
import type { ProgramCalendarSlotType, ProgramSessionCategory } from "@/app/generated/prisma/enums";
import { isProgramSessionCategory } from "@/lib/program-session-category";

function requirePrincipalId(session: Session | null): string | null {
  if (!session?.user?.id) return null;
  if (!hasPrincipalPortalAccess(session)) return null;
  return session.user.id;
}

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!requirePrincipalId(session)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { id } = await params;
  const body = await req.json().catch(() => ({}));
  const { slotDate, startTime, endTime, colorHex, slotType, teacherUserId, subjectId, sortOrder, sessionCategory } =
    body as Record<string, unknown>;

  const existing = await db.programCalendarSlot.findUnique({ where: { id } });
  if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const st = (startTime as string) ?? existing.startTime;
  const et = (endTime as string) ?? existing.endTime;
  if (slotDurationMinutes(st, et) <= 0) {
    return NextResponse.json({ error: "Invalid time range" }, { status: 400 });
  }

  const nextType =
    slotType === "LUNCH" || slotType === "SESSION" ? (slotType as ProgramCalendarSlotType) : existing.slotType;

  let categoryData: { sessionCategory: ProgramSessionCategory | null } | Record<string, never> = {};
  if (nextType === "LUNCH") {
    categoryData = { sessionCategory: null };
  } else if (sessionCategory !== undefined) {
    if (sessionCategory === null || sessionCategory === "") {
      categoryData = { sessionCategory: null };
    } else if (isProgramSessionCategory(String(sessionCategory))) {
      categoryData = { sessionCategory: sessionCategory as ProgramSessionCategory };
    } else {
      return NextResponse.json({ error: "Invalid sessionCategory" }, { status: 400 });
    }
  }

  const updated = await db.programCalendarSlot.update({
    where: { id },
    data: {
      ...(slotDate ? { slotDate: new Date(slotDate as string) } : {}),
      startTime: st,
      endTime: et,
      ...(colorHex != null ? { colorHex: String(colorHex) } : {}),
      ...(slotType === "LUNCH" || slotType === "SESSION" ? { slotType: nextType } : {}),
      ...(typeof teacherUserId === "string" ? { teacherUserId } : {}),
      ...(subjectId === null ? { subjectId: null } : typeof subjectId === "string" ? { subjectId } : {}),
      ...(typeof sortOrder === "number" ? { sortOrder } : {}),
      ...categoryData,
    },
  });

  return NextResponse.json(updated);
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!requirePrincipalId(session)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { id } = await params;
  await db.programCalendarSlot.delete({ where: { id } }).catch(() => null);
  return NextResponse.json({ ok: true });
}
