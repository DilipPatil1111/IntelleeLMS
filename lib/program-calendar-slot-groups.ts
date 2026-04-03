import { toHHmm } from "@/lib/program-calendar-hours";

/** Minimal slot shape for grouping (Full Calendar list + grid). */
export type GroupableSlot = {
  id: string;
  slotDate: string;
  startTime: string;
  endTime: string;
  slotType: string;
  sessionCategory: string | null;
  colorHex: string;
  teacher: { id: string; firstName: string; lastName: string };
  subject: { id: string; name: string } | null;
};

export type CalendarSlotRun = {
  /** Stable id for React keys — one logical block per teacher/time/session/color/subject. */
  key: string;
  dateFrom: string;
  dateTo: string;
  slotIds: string[];
  startTime: string;
  endTime: string;
  slotType: string;
  sessionCategory: string | null;
  colorHex: string;
  teacher: GroupableSlot["teacher"];
  subject: GroupableSlot["subject"];
};

/**
 * Build grouping key using normalized times so "09:00" and "09:00:00" merge.
 */
function groupKey(s: GroupableSlot): string {
  return [
    s.teacher.id,
    toHHmm(s.startTime),
    toHHmm(s.endTime),
    s.slotType,
    s.sessionCategory ?? "",
    s.colorHex.toLowerCase(),
    s.subject?.id ?? "",
  ].join("|");
}

/**
 * One row per unique teacher + time band + session + category + color + subject.
 * Date range = min … max calendar day among those slots (within the loaded filter).
 */
export function groupSlotsIntoMergedBlocks(slots: GroupableSlot[]): CalendarSlotRun[] {
  const byKey = new Map<string, GroupableSlot[]>();
  for (const s of slots) {
    const k = groupKey(s);
    const arr = byKey.get(k) || [];
    arr.push(s);
    byKey.set(k, arr);
  }

  const runs: CalendarSlotRun[] = [];

  for (const [k, group] of byKey) {
    const sorted = [...group].sort((a, b) => a.slotDate.localeCompare(b.slotDate));
    const first = sorted[0]!;
    const last = sorted[sorted.length - 1]!;
    runs.push({
      key: k,
      dateFrom: first.slotDate,
      dateTo: last.slotDate,
      slotIds: sorted.map((x) => x.id),
      startTime: toHHmm(first.startTime),
      endTime: toHHmm(first.endTime),
      slotType: first.slotType,
      sessionCategory: first.sessionCategory,
      colorHex: first.colorHex,
      teacher: first.teacher,
      subject: first.subject,
    });
  }

  return runs.sort(
    (a, b) =>
      a.dateFrom.localeCompare(b.dateFrom) || a.startTime.localeCompare(b.startTime) || a.teacher.id.localeCompare(b.teacher.id),
  );
}

/** Format range as single day or "from → to". */
export function formatDateRangeLabel(fromYmd: string, toYmd: string): string {
  if (fromYmd === toYmd) return fromYmd;
  return `${fromYmd} → ${toYmd}`;
}
