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

export async function GET() {
  const session = await auth();
  const denied = requirePrincipal(session);
  if (denied) return denied;

  const years = await db.academicYear.findMany({ orderBy: { startDate: "desc" } });
  return NextResponse.json({ years });
}

export async function POST(req: Request) {
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
    return tx.academicYear.create({
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
