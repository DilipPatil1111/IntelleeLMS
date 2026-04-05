import { timeToMinutes } from "@/lib/program-calendar-hours";
import { eachLocalDayInclusive, formatYmd } from "@/lib/day-boundaries";

/** Hour rows for the grid: 8:00–21:59 (customize later). */
export const GRID_DAY_START_HOUR = 8;
export const GRID_DAY_END_HOUR = 22;

export function hourRowLabels(): { hour: number; label: string }[] {
  const out: { hour: number; label: string }[] = [];
  for (let h = GRID_DAY_START_HOUR; h < GRID_DAY_END_HOUR; h++) {
    const ampm = h >= 12 ? "PM" : "AM";
    const hr12 = h % 12 === 0 ? 12 : h % 12;
    out.push({ hour: h, label: `${hr12}:00 ${ampm}` });
  }
  return out;
}

export function slotOverlapsHour(startTime: string, endTime: string, hour: number): boolean {
  const sm = timeToMinutes(startTime);
  const em = timeToMinutes(endTime);
  if (sm == null || em == null || em <= sm) return false;
  const hs = hour * 60;
  const he = (hour + 1) * 60;
  return sm < he && em > hs;
}

export function ymdRange(fromYmd: string, toYmd: string): string[] {
  const fp = fromYmd.split("-").map(Number);
  const tp = toYmd.split("-").map(Number);
  if (fp.length !== 3 || tp.length !== 3) return [];
  const start = new Date(fp[0], fp[1] - 1, fp[2]);
  const end = new Date(tp[0], tp[1] - 1, tp[2]);
  return eachLocalDayInclusive(start, end).map((d) => formatYmd(d));
}

export function isWeekendYmd(ymd: string): boolean {
  const [y, m, d] = ymd.split("-").map(Number);
  const dt = new Date(y, m - 1, d);
  const day = dt.getDay();
  return day === 0 || day === 6;
}
