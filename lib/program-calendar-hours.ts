/**
 * Parse common time strings to minutes from midnight.
 * Supports `HH:mm`, `HH:mm:ss`, and 12-hour `h:mm AM/PM` (single-session UI / DB).
 */
export function timeToMinutes(t: string | null | undefined): number | null {
  if (t == null || typeof t !== "string") return null;
  const s = t.trim();
  if (!s) return null;

  const m24 = /^(\d{1,2}):(\d{2})(?::(\d{2}))?$/.exec(s);
  if (m24) {
    const h = Number(m24[1]);
    const min = Number(m24[2]);
    if (h >= 0 && h <= 23 && min >= 0 && min <= 59) return h * 60 + min;
    return null;
  }

  const m12 = /^(\d{1,2}):(\d{2})\s*(AM|PM)$/i.exec(s);
  if (m12) {
    let h = Number(m12[1]);
    const min = Number(m12[2]);
    const ap = m12[3].toUpperCase();
    if (h < 1 || h > 12 || min < 0 || min > 59) return null;
    if (ap === "PM" && h !== 12) h += 12;
    if (ap === "AM" && h === 12) h = 0;
    return h * 60 + min;
  }

  return null;
}

export function slotDurationMinutes(startTime: string | null | undefined, endTime: string | null | undefined): number {
  const a = timeToMinutes(startTime);
  const b = timeToMinutes(endTime);
  if (a == null || b == null || b <= a) return 0;
  return b - a;
}

/** Normalize any supported time string to `HH:mm` for grouping, APIs, and inputs. */
export function toHHmm(t: string | null | undefined): string {
  if (t == null || typeof t !== "string") return "";
  const m = timeToMinutes(t);
  if (m == null) return t.trim();
  const h = Math.floor(m / 60);
  const min = m % 60;
  return `${String(h).padStart(2, "0")}:${String(min).padStart(2, "0")}`;
}
