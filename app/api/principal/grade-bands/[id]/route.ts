import { requirePrincipalPortal } from "@/lib/api-auth";
import { db } from "@/lib/db";
import { NextResponse } from "next/server";

export async function PUT(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const gate = await requirePrincipalPortal();
  if (!gate.ok) return gate.response;
  const { id } = await params;

  const body = await req.json();
  const { label, minPercent, maxPercent, gradePoint, sortOrder } = body;

  const band = await db.gradeBand.update({
    where: { id },
    data: {
      label: String(label).trim(),
      minPercent: Number(minPercent),
      maxPercent: Number(maxPercent),
      gradePoint: gradePoint != null ? Number(gradePoint) : null,
      sortOrder: sortOrder != null ? Number(sortOrder) : 0,
    },
  });
  return NextResponse.json({ band });
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const gate = await requirePrincipalPortal();
  if (!gate.ok) return gate.response;
  const { id } = await params;

  await db.gradeBand.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
