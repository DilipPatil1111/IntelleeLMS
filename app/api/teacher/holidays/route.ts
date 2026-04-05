import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { hasTeacherPortalAccess } from "@/lib/portal-access";
import { NextResponse } from "next/server";

/** View-only holiday list for teachers (same shape as principal GET). */
export async function GET(req: Request) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!hasTeacherPortalAccess(session)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

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

  const page = Math.max(1, Number.parseInt(searchParams.get("page") || "1", 10) || 1);
  let pageSize = Number.parseInt(searchParams.get("pageSize") || "10", 10) || 10;
  pageSize = Math.min(Math.max(1, pageSize), 50);
  const total = filtered.length;
  const start = (page - 1) * pageSize;
  const holidays = filtered.slice(start, start + pageSize);

  return NextResponse.json({
    holidays,
    total,
    page,
    pageSize,
    byYear: Object.fromEntries(byYear),
  });
}
