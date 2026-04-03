import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { hasTeacherPortalAccess } from "@/lib/portal-access";
import { NextResponse } from "next/server";
import { formatYmd } from "@/lib/day-boundaries";

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!hasTeacherPortalAccess(session)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const body = await req.json().catch(() => ({}));
  const { batchId, slotDate, message } = body as { batchId?: string; slotDate?: string; message?: string };
  if (!batchId || !slotDate) return NextResponse.json({ error: "batchId and slotDate required" }, { status: 400 });

  const tp = await db.teacherProfile.findUnique({
    where: { userId: session.user.id },
    select: { id: true },
  });
  if (!tp) return NextResponse.json({ error: "No teacher profile" }, { status: 403 });

  const assigned = await db.teacherSubjectAssignment.findFirst({
    where: { batchId, teacherProfileId: tp.id },
  });
  if (!assigned) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const teacher = await db.user.findUnique({
    where: { id: session.user.id },
    select: { firstName: true, lastName: true },
  });
  const d = new Date(slotDate);
  const dateStr = formatYmd(d);
  const link = `/principal/full-calendar?batchId=${encodeURIComponent(batchId)}&date=${encodeURIComponent(dateStr)}`;
  const msg =
    message?.trim() ||
    `${teacher?.firstName ?? "Teacher"} ${teacher?.lastName ?? ""} requests a schedule update for ${dateStr}.`;

  const principals = await db.user.findMany({
    where: { role: "PRINCIPAL", isActive: true },
    select: { id: true },
  });

  for (const p of principals) {
    await db.notification.create({
      data: {
        userId: p.id,
        type: "CALENDAR_HOURS_UPDATE_REQUEST",
        title: "Calendar / hours update requested",
        message: msg,
        link,
      },
    });
  }

  return NextResponse.json({ ok: true, notified: principals.length });
}
