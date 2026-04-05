/** All values persisted on `Holiday.type` — keep in sync with Prisma `HolidayType` enum. */
export const HOLIDAY_TYPES = [
  "PUBLIC",
  "COLLEGE",
  "CUSTOM",
  "SUMMER_BREAK",
  "WINTER_BREAK",
  "EXAM_PREPARATION_LEAVE",
] as const;

export type HolidayTypeValue = (typeof HOLIDAY_TYPES)[number];

export function isHolidayType(value: string): value is HolidayTypeValue {
  return (HOLIDAY_TYPES as readonly string[]).includes(value);
}

/** Dropdown options: Principal / administrator creates entries; name field holds the display title (e.g. “Diwali”, “Mid-term exams”). */
export const HOLIDAY_TYPE_FORM_OPTIONS: { value: HolidayTypeValue; label: string; hint?: string }[] = [
  { value: "PUBLIC", label: "Public holiday", hint: "Government / national observances" },
  { value: "COLLEGE", label: "College holiday", hint: "Institution-wide closure" },
  { value: "CUSTOM", label: "Custom", hint: "Any other day off — use the name field (e.g. staff retreat)" },
  { value: "SUMMER_BREAK", label: "Summer break", hint: "Typically multi-day; add one row per date or repeat" },
  { value: "WINTER_BREAK", label: "Winter break", hint: "Typically multi-day; add one row per date or repeat" },
  { value: "EXAM_PREPARATION_LEAVE", label: "Exam preparation leave", hint: "Study / prep days before assessments" },
];

export function holidayTypeLabel(type: string): string {
  const row = HOLIDAY_TYPE_FORM_OPTIONS.find((o) => o.value === type);
  return row?.label ?? type.replace(/_/g, " ");
}

/** Tailwind dot color for list rows (principal holidays page). */
export function holidayTypeDotClass(type: string): string {
  switch (type) {
    case "PUBLIC":
      return "bg-red-500";
    case "COLLEGE":
      return "bg-orange-500";
    case "SUMMER_BREAK":
      return "bg-sky-500";
    case "WINTER_BREAK":
      return "bg-cyan-600";
    case "EXAM_PREPARATION_LEAVE":
      return "bg-violet-500";
    case "CUSTOM":
    default:
      return "bg-gray-400";
  }
}

/** For `<Badge variant={…} />` on holiday list rows. */
export function holidayBadgeVariant(type: string): "default" | "success" | "warning" | "danger" | "info" {
  switch (type) {
    case "PUBLIC":
      return "danger";
    case "COLLEGE":
      return "warning";
    case "SUMMER_BREAK":
    case "WINTER_BREAK":
      return "info";
    case "EXAM_PREPARATION_LEAVE":
      return "success";
    case "CUSTOM":
    default:
      return "default";
  }
}
