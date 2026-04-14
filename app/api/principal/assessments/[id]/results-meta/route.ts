import { requirePrincipalPortal } from "@/lib/api-auth";
import { db } from "@/lib/db";
import { NextResponse } from "next/server";

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const gate = await requirePrincipalPortal();
  if (!gate.ok) return gate.response;
  const { id } = await params;

  const existing = await db.assessment.findUnique({
    where: { id },
    select: { id: true },
  });
  if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const body = await req.json();

  const data: Record<string, unknown> = {};

  if (typeof body.title === "string" && body.title.trim()) data.title = body.title.trim();
  if (typeof body.type === "string") data.type = body.type;
  if (typeof body.totalMarks === "number") data.totalMarks = body.totalMarks;
  if (body.passingMarks !== undefined) data.passingMarks = body.passingMarks === null ? null : Number(body.passingMarks);
  if (body.durationMinutes !== undefined) data.duration = body.durationMinutes === null ? null : Number(body.durationMinutes);
  if (body.assessmentDate !== undefined) data.assessmentDate = body.assessmentDate ? new Date(body.assessmentDate) : null;
  if (body.createdAt !== undefined) data.createdAt = body.createdAt ? new Date(body.createdAt) : undefined;
  if (typeof body.subjectId === "string") data.subjectId = body.subjectId;
  if (typeof body.batchId === "string") data.batchId = body.batchId;

  if (Object.keys(data).length === 0) {
    return NextResponse.json({ error: "No valid fields to update" }, { status: 400 });
  }

  await db.assessment.update({ where: { id }, data });

  return NextResponse.json({ success: true });
}
