import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { sendEmail } from "@/lib/email";
import { resolveStudentEmails } from "@/lib/mail-audience";
import { NextResponse } from "next/server";

export async function GET(req: Request) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

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

  const body = await req.json();
  const holiday = await db.holiday.create({
    data: {
      name: body.name,
      date: new Date(body.date),
      type: body.type || "PUBLIC",
      academicYearId: body.academicYearId || null,
    },
  });

  const current = await db.academicYear.findFirst({ where: { isCurrent: true } });
  if (current && holiday.academicYearId === current.id) {
    const emails = await resolveStudentEmails({ academicYearId: current.id });
    for (const to of emails) {
      await sendEmail({
        to,
        subject: `Holiday update: ${holiday.name}`,
        html: `<p>Intellee College has added a holiday: <strong>${holiday.name}</strong> on ${new Date(holiday.date).toLocaleDateString()}.</p>`,
        text: `Holiday: ${holiday.name} on ${new Date(holiday.date).toLocaleDateString()}`,
      });
    }
  }

  return NextResponse.json({ holiday });
}
