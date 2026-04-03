import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { hasStudentPortalAccess } from "@/lib/portal-access";
import { NextResponse } from "next/server";

/** Holidays for the student’s batch academic year (view-only). */
export async function GET() {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!hasStudentPortalAccess(session)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const profile = await db.studentProfile.findUnique({
    where: { userId: session.user.id },
    include: { batch: { select: { academicYearId: true } } },
  });
  const ayId = profile?.batch?.academicYearId;
  if (!ayId) {
    return NextResponse.json({ holidays: [] });
  }

  const holidays = await db.holiday.findMany({
    where: { academicYearId: ayId },
    include: { academicYear: { select: { id: true, name: true } } },
    orderBy: { date: "asc" },
  });

  return NextResponse.json({ holidays });
}
