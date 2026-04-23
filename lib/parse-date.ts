/**
 * Safely parse an unknown value (typically from a JSON request body) into a
 * Date, or return null if it is missing / empty / unparseable.
 *
 * Why this exists:
 *   `new Date(input)` happily returns an "Invalid Date" object for inputs like
 *   `"2025-8-28T9:0"`, `"Invalid Date"`, `"2025-08-28T"`, etc. Passing such an
 *   object to Prisma triggers:
 *     "Invalid value for argument: Provided Date object is invalid."
 *
 *   Browsers (notably older Safari / iOS date-time pickers) can send these
 *   malformed strings even when the UI looks correct, so every date field
 *   coming from a client must be validated before handing it to Prisma.
 *
 * Accepts: string, number, Date, null, undefined, or any unknown value.
 * Returns: a valid Date instance, or null.
 */
export function parseDateSafe(input: unknown): Date | null {
  if (input === null || input === undefined || input === "") return null;
  // Accept Date instances as long as they represent a real moment in time.
  if (input instanceof Date) {
    return Number.isFinite(input.getTime()) ? input : null;
  }
  // Accept strings and finite numeric timestamps. Anything else is rejected up
  // front so we never construct a garbage Date object.
  if (typeof input !== "string" && typeof input !== "number") return null;
  if (typeof input === "number" && !Number.isFinite(input)) return null;

  const parsed = new Date(input);
  return Number.isFinite(parsed.getTime()) ? parsed : null;
}

/**
 * Human-friendly labels shown back to the user when a date field fails
 * validation. Falls back to the raw field name if not mapped.
 */
const DATE_FIELD_LABELS: Record<string, string> = {
  scheduledOpenAt: "Open At",
  scheduledCloseAt: "Close At",
  assessmentDate: "Assessment Date",
  createdAt: "Created Date",
};

export type ParseDateFieldsResult =
  | { ok: true; values: Record<string, Date | null> }
  | { ok: false; field: string; label: string };

/**
 * Validate and parse a set of date fields from a JSON request body.
 *
 * - Missing / null / empty-string values resolve to `null` (not provided).
 * - Non-empty values MUST parse into a real Date. A truthy-but-unparseable
 *   input (e.g. "2025-8-28T9:0", "Invalid Date", a half-typed datetime-local
 *   value from an older mobile browser) short-circuits with `ok: false` so
 *   the route can return a 400 and the UI can surface a clear error.
 *
 * Use this at the top of any API handler that accepts client-supplied dates
 * instead of calling `new Date(...)` directly. Passing an Invalid Date to
 * Prisma otherwise crashes with:
 *   "Provided Date object is invalid. Expected Date."
 */
export function parseDateFields(
  input: Record<string, unknown>,
  fields: readonly string[]
): ParseDateFieldsResult {
  const values: Record<string, Date | null> = {};
  for (const field of fields) {
    const raw = input[field];
    if (raw === undefined || raw === null || raw === "") {
      values[field] = null;
      continue;
    }
    const parsed = parseDateSafe(raw);
    if (!parsed) {
      return { ok: false, field, label: DATE_FIELD_LABELS[field] ?? field };
    }
    values[field] = parsed;
  }
  return { ok: true, values };
}
