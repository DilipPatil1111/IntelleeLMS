import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import type { Session } from "next-auth";
import { NextResponse } from "next/server";

function requirePrincipal(session: Session | null) {
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const role = (session.user as unknown as Record<string, unknown>).role as string;
  if (role !== "PRINCIPAL") return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  return null;
}

export async function PUT(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await auth();
  const denied = requirePrincipal(session);
  if (denied) return denied;

  const body = await req.json();
  const name = typeof body.name === "string" ? body.name.trim() : "";
  if (!name) return NextResponse.json({ error: "Name is required" }, { status: 400 });

  const start = new Date(body.startDate);
  const end = new Date(body.endDate);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
    return NextResponse.json({ error: "Invalid start or end date" }, { status: 400 });
  }
  if (end < start) {
    return NextResponse.json({ error: "End date must be on or after start date" }, { status: 400 });
  }

  const isCurrent = Boolean(body.isCurrent);

  const year = await db.$transaction(async (tx) => {
    if (isCurrent) {
      await tx.academicYear.updateMany({ data: { isCurrent: false } });
    }
    return tx.academicYear.update({
      where: { id },
      data: {
        name,
        startDate: start,
        endDate: end,
        isCurrent,
      },
    });
  });

  return NextResponse.json({ year });
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await auth();
  const denied = requirePrincipal(session);
  if (denied) return denied;

  const [batchCount, holidayCount, announcementCount] = await Promise.all([
    db.batch.count({ where: { academicYearId: id } }),
    db.holiday.count({ where: { academicYearId: id } }),
    db.announcement.count({ where: { academicYearId: id } }),
  ]);

  if (batchCount > 0 || holidayCount > 0 || announcementCount > 0) {
    return NextResponse.json(
      {
        error:
          "Cannot delete this academic year while batches, holidays, or announcements reference it. Remove or reassign those first.",
      },
      { status: 409 }
    );
  }

  try {
    await db.academicYear.delete({ where: { id } });
  } catch {
    return NextResponse.json(
      { error: "Cannot delete this academic year; it may still be referenced elsewhere." },
      { status: 409 }
    );
  }

  return NextResponse.json({ success: true });
}
