import type { Session } from "next-auth";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { fetchHolidaysInYmdRange } from "@/lib/holidays-in-range";
import { hasPrincipalPortalAccess } from "@/lib/portal-access";
import { NextResponse } from "next/server";
import { formatYmd } from "@/lib/day-boundaries";
import { slotDurationMinutes, timeToMinutes, toHHmm } from "@/lib/program-calendar-hours";
import type { ProgramCalendarSlotType, ProgramSessionCategory } from "@/app/generated/prisma/enums";
import { isProgramSessionCategory } from "@/lib/program-session-category";
import { defaultTeacherSlotColor } from "@/lib/teacher-slot-color";

function requirePrincipalId(session: Session | null): string | null {
  if (!session?.user?.id) return null;
  if (!hasPrincipalPortalAccess(session)) return null;
  return session.user.id;
}

export async function GET(req: Request) {
  const session = await auth();
  const uid = requirePrincipalId(session);
  if (!uid) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { searchParams } = new URL(req.url);
  const batchId = searchParams.get("batchId");
  const from = searchParams.get("from");
  const to = searchParams.get("to");
  if (!batchId) return NextResponse.json({ error: "batchId required" }, { status: 400 });

  const where: Record<string, unknown> = { batchId };
  if (from && to) {
    where.slotDate = {
      gte: new Date(from),
      lte: new Date(to),
    };
  }

  const [slots, holidays] = await Promise.all([
    db.programCalendarSlot.findMany({
      where,
      include: {
        teacher: { select: { id: true, firstName: true, lastName: true, email: true } },
        subject: { select: { id: true, name: true, code: true } },
        batch: { include: { program: true, academicYear: true } },
      },
      orderBy: [{ slotDate: "asc" }, { sortOrder: "asc" }, { startTime: "asc" }],
    }),
    from && to ? fetchHolidaysInYmdRange(from, to) : Promise.resolve([]),
  ]);

  return NextResponse.json({ slots, holidays });
}

export async function POST(req: Request) {
  const session = await auth();
  const uid = requirePrincipalId(session);
  if (!uid) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const body = await req.json().catch(() => ({}));
  const {
    programId,
    batchId,
    teacherUserId,
    subjectId,
    slotType,
    startTime,
    endTime,
    colorHex,
    sortOrder,
    dates,
    sessionCategory,
  } = body as {
    programId?: string;
    batchId?: string;
    teacherUserId?: string;
    subjectId?: string | null;
    slotType?: ProgramCalendarSlotType;
    startTime?: string;
    endTime?: string;
    colorHex?: string;
    sortOrder?: number;
    dates?: string[];
    sessionCategory?: string | null;
  };

  if (!programId || !batchId || !teacherUserId || !startTime || !endTime || !Array.isArray(dates) || dates.length === 0) {
    return NextResponse.json({ error: "programId, batchId, teacherUserId, startTime, endTime, dates[] required" }, { status: 400 });
  }

  if (slotDurationMinutes(startTime, endTime) <= 0) {
    return NextResponse.json({ error: "Invalid time range" }, { status: 400 });
  }

  const type: ProgramCalendarSlotType = slotType === "LUNCH" ? "LUNCH" : "SESSION";

  let category: ProgramSessionCategory | null = null;
  if (type === "SESSION" && sessionCategory != null && sessionCategory !== "") {
    if (!isProgramSessionCategory(String(sessionCategory))) {
      return NextResponse.json({ error: "Invalid sessionCategory" }, { status: 400 });
    }
    category = sessionCategory as ProgramSessionCategory;
  }

  const hex =
    typeof colorHex === "string" && /^#[0-9A-Fa-f]{6}$/.test(colorHex.trim())
      ? colorHex.trim()
      : defaultTeacherSlotColor(teacherUserId);

  const st = toHHmm(startTime);
  const et = toHHmm(endTime);

  const existing = await db.programCalendarSlot.findMany({
    where: {
      batchId,
      teacherUserId,
      slotDate: { in: dates.map((d) => new Date(d)) },
    },
  });

  function alreadyExists(dateYmd: string): boolean {
    return existing.some((s) => {
      if (formatYmd(new Date(s.slotDate)) !== dateYmd) return false;
      if (s.slotType !== type) return false;
      if ((s.sessionCategory ?? null) !== (category ?? null)) return false;
      return timeToMinutes(s.startTime) === timeToMinutes(st) && timeToMinutes(s.endTime) === timeToMinutes(et);
    });
  }

  const newDates = dates.filter((d) => !alreadyExists(d.trim()));

  if (newDates.length === 0) {
    return NextResponse.json({ created: 0, skipped: dates.length });
  }

  const created = await db.programCalendarSlot.createMany({
    data: newDates.map((d) => ({
      programId,
      batchId,
      teacherUserId,
      subjectId: subjectId || null,
      slotDate: new Date(d),
      slotType: type,
      sessionCategory: category,
      startTime: st,
      endTime: et,
      colorHex: hex,
      sortOrder: sortOrder ?? 0,
    })),
  });

  return NextResponse.json({ created: created.count, skipped: dates.length - newDates.length });
}
