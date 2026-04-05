import { db } from "@/lib/db";
import { endOfLocalDay, formatYmd, startOfLocalDay } from "@/lib/day-boundaries";

export type HolidayRow = { date: string; name: string; type: string };

/** Institution holidays whose calendar date falls in [fromYmd, toYmd] (inclusive). */
export async function fetchHolidaysInYmdRange(fromYmd: string, toYmd: string): Promise<HolidayRow[]> {
  const [fy, fm, fd] = fromYmd.split("-").map(Number);
  const [ty, tm, td] = toYmd.split("-").map(Number);
  if (![fy, fm, fd, ty, tm, td].every((n) => Number.isFinite(n))) return [];
  const fromD = startOfLocalDay(new Date(fy, fm - 1, fd));
  const toD = endOfLocalDay(new Date(ty, tm - 1, td));
  if (fromD > toD) return [];

  const rows = await db.holiday.findMany({
    where: { date: { gte: fromD, lte: toD } },
    orderBy: { date: "asc" },
    select: { date: true, name: true, type: true },
  });
  return rows.map((h) => ({
    date: formatYmd(new Date(h.date)),
    name: h.name,
    type: h.type,
  }));
}
