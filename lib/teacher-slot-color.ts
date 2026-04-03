/** Default palette when principal does not set `colorHex` — stable per-teacher hue. */
const PALETTE = [
  "#6366f1",
  "#22c55e",
  "#0ea5e9",
  "#eab308",
  "#a855f7",
  "#f97316",
  "#ec4899",
  "#14b8a6",
  "#84cc16",
];

export function defaultTeacherSlotColor(teacherUserId: string): string {
  let h = 0;
  for (let i = 0; i < teacherUserId.length; i++) {
    h = (h * 31 + teacherUserId.charCodeAt(i)) >>> 0;
  }
  return PALETTE[h % PALETTE.length];
}
