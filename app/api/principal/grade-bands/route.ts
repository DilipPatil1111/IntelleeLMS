import { requirePrincipalPortal } from "@/lib/api-auth";
import { db } from "@/lib/db";
import { NextResponse } from "next/server";

export async function GET() {
  const gate = await requirePrincipalPortal();
  if (!gate.ok) return gate.response;

  const bands = await db.gradeBand.findMany({ orderBy: { sortOrder: "asc" } });
  return NextResponse.json({ bands });
}

export async function POST(req: Request) {
  const gate = await requirePrincipalPortal();
  if (!gate.ok) return gate.response;

  const body = await req.json();
  const { label, minPercent, maxPercent, gradePoint, sortOrder } = body;
  if (!label || minPercent == null || maxPercent == null) {
    return NextResponse.json({ error: "label, minPercent and maxPercent are required" }, { status: 400 });
  }

  const band = await db.gradeBand.create({
    data: {
      label: String(label).trim(),
      minPercent: Number(minPercent),
      maxPercent: Number(maxPercent),
      gradePoint: gradePoint != null ? Number(gradePoint) : null,
      sortOrder: sortOrder != null ? Number(sortOrder) : 0,
    },
  });
  return NextResponse.json({ band }, { status: 201 });
}
