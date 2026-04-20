import { requirePrincipalPortal } from "@/lib/api-auth";
import {
  AUTO_FIX_CATEGORIES,
  applyAttendanceSync,
  diagnoseAttendanceSync,
  type SyncCategory,
} from "@/lib/attendance-sync";
import { NextResponse } from "next/server";

export const runtime = "nodejs";

/** GET — read-only diagnosis of cross-table attendance/enrollment drift. */
export async function GET() {
  const gate = await requirePrincipalPortal();
  if (!gate.ok) return gate.response;

  const data = await diagnoseAttendanceSync();
  return NextResponse.json(data, { headers: { "Cache-Control": "no-store" } });
}

/**
 * POST — apply the named categories. Body:
 *   { categories: ("missing_program_enrollment" | "missing_profile_batch")[] }
 *
 * Only auto-fix categories listed in AUTO_FIX_CATEGORIES are honored.
 * Anything else (e.g. "orphan_attendance_records") is rejected — those are
 * strictly diagnostic to avoid destructive auto-cleanups on production data.
 */
export async function POST(req: Request) {
  const gate = await requirePrincipalPortal();
  if (!gate.ok) return gate.response;

  const body = (await req.json().catch(() => ({}))) as { categories?: unknown };
  const raw = Array.isArray(body.categories) ? body.categories : [];
  const categories: SyncCategory[] = raw
    .filter((x): x is string => typeof x === "string")
    .filter((x): x is SyncCategory => AUTO_FIX_CATEGORIES.includes(x as SyncCategory));

  if (categories.length === 0) {
    return NextResponse.json(
      {
        error:
          "No applicable categories provided. Accepted values: " +
          AUTO_FIX_CATEGORIES.join(", "),
      },
      { status: 400 },
    );
  }

  const result = await applyAttendanceSync({
    categories,
    actorUserId: gate.session.user.id,
  });

  return NextResponse.json(result, { headers: { "Cache-Control": "no-store" } });
}
