import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { fetchHolidaysInYmdRange } from "@/lib/holidays-in-range";
import { hasTeacherPortalAccess } from "@/lib/portal-access";
import { getTeacherVisibleBatchIds } from "@/lib/teacher-visible-batches";
import { NextResponse } from "next/server";

export async function GET(req: Request) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!hasTeacherPortalAccess(session)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { searchParams } = new URL(req.url);
  const batchId = searchParams.get("batchId");
  const from = searchParams.get("from");
  const to = searchParams.get("to");
  if (!batchId) return NextResponse.json({ error: "batchId required" }, { status: 400 });

  const allowed = await getTeacherVisibleBatchIds(session.user.id);
  if (!allowed.includes(batchId)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const where: Record<string, unknown> = { batchId };
  if (from && to) {
    where.slotDate = { gte: new Date(from), lte: new Date(to) };
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
