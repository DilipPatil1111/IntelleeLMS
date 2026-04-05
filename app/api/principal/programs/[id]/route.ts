import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { NextResponse } from "next/server";

export async function PUT(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  const durationText = typeof body.durationText === "string" ? body.durationText.trim() : "";
  const optFloat = (v: unknown) =>
    v === null || v === "" ? null : typeof v === "number" && Number.isFinite(v) ? v : undefined;
  const optId = (v: unknown) =>
    v === null || v === ""
      ? null
      : typeof v === "string" && v.trim() !== ""
        ? v.trim()
        : undefined;

  const program = await db.program.update({
    where: { id },
    data: {
      name: body.name,
      code: body.code,
      description: body.description || null,
      durationYears: typeof body.durationYears === "number" ? body.durationYears : 1,
      durationText: durationText || null,
      ...(Object.prototype.hasOwnProperty.call(body, "programDomainId") && {
        programDomainId: optId(body.programDomainId) ?? null,
      }),
      ...(Object.prototype.hasOwnProperty.call(body, "programCategoryId") && {
        programCategoryId: optId(body.programCategoryId) ?? null,
      }),
      ...(Object.prototype.hasOwnProperty.call(body, "programTypeId") && {
        programTypeId: optId(body.programTypeId) ?? null,
      }),
      ...(Object.prototype.hasOwnProperty.call(body, "minAttendancePercent") && {
        minAttendancePercent: optFloat(body.minAttendancePercent) ?? null,
      }),
      ...(Object.prototype.hasOwnProperty.call(body, "minAverageMarksPercent") && {
        minAverageMarksPercent: optFloat(body.minAverageMarksPercent) ?? null,
      }),
      ...(Object.prototype.hasOwnProperty.call(body, "minFeePaidPercent") && {
        minFeePaidPercent: optFloat(body.minFeePaidPercent) ?? null,
      }),
    },
    include: {
      programDomain: { select: { id: true, name: true, customerId: true } },
      programCategory: { select: { id: true, name: true, customerId: true } },
      programType: { select: { id: true, name: true, customerId: true } },
    },
  });

  return NextResponse.json({ program });
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  await db.program.delete({ where: { id } });
  return NextResponse.json({ success: true });
}
