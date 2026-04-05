import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { sendEmailWithSignature } from "@/lib/email-signature";
import { isHolidayType } from "@/lib/holiday-types";
import { resolveStudentEmails } from "@/lib/mail-audience";
import { hasPrincipalPortalAccess } from "@/lib/portal-access";
import { NextResponse } from "next/server";
import type { HolidayType } from "@/app/generated/prisma/enums";

export async function GET(req: Request) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!hasPrincipalPortalAccess(session)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { searchParams } = new URL(req.url);
  const years = parseInt(searchParams.get("years") || "2", 10) || 2;

  const all = await db.holiday.findMany({
    include: { academicYear: { select: { id: true, name: true } } },
    orderBy: { date: "asc" },
  });

  const now = new Date();
  const cutoff = new Date(now.getFullYear() - years + 1, 0, 1);
  const filtered = all.filter((h) => new Date(h.date) >= cutoff);

  const byYear = new Map<number, typeof filtered>();
  for (const h of filtered) {
    const y = new Date(h.date).getFullYear();
    if (!byYear.has(y)) byYear.set(y, []);
    byYear.get(y)!.push(h);
  }

  return NextResponse.json({ holidays: filtered, byYear: Object.fromEntries(byYear) });
}

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!hasPrincipalPortalAccess(session)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const body = await req.json();
  const rawType = typeof body.type === "string" ? body.type.trim() : "";
  if (rawType && !isHolidayType(rawType)) {
    return NextResponse.json({ error: "Invalid holiday type" }, { status: 400 });
  }
  const type: HolidayType = rawType && isHolidayType(rawType) ? rawType : "PUBLIC";

  const holiday = await db.holiday.create({
    data: {
      name: body.name,
      date: new Date(body.date),
      type,
      academicYearId: body.academicYearId || null,
    },
  });

  const current = await db.academicYear.findFirst({ where: { isCurrent: true } });
  if (current && holiday.academicYearId === current.id) {
    const emails = await resolveStudentEmails({ academicYearId: current.id });
    for (const to of emails) {
      await sendEmailWithSignature({
        to,
        subject: `Holiday update: ${holiday.name}`,
        html: `<div style="font-family:sans-serif;max-width:600px;">{INSTITUTION_HEADER}<p>A holiday has been added: <strong>${holiday.name}</strong> on ${new Date(holiday.date).toLocaleDateString()}.</p></div>`,
        text: `Holiday: ${holiday.name} on ${new Date(holiday.date).toLocaleDateString()}`,
        senderUserId: session.user.id,
      });
    }
  }

  return NextResponse.json({ holiday });
}
