import { requireTeacherPortal } from "@/lib/api-auth";
import { canViewAssessmentResults } from "@/lib/assessment-detailed-results";
import { db } from "@/lib/db";
import { parseDateFields } from "@/lib/parse-date";
import { NextResponse } from "next/server";

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const gate = await requireTeacherPortal();
  if (!gate.ok) return gate.response;
  const session = gate.session;
  const { id } = await params;

  const allowed = await canViewAssessmentResults(session.user.id, session, id);
  if (!allowed) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

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
  // Validate client-supplied dates. Only check fields the caller sent
  // (PATCH semantics: missing keys aren't modified). A truthy-but-bad value
  // returns 400 instead of crashing Prisma with "Invalid Date".
  const dateFields = (["assessmentDate", "createdAt"] as const).filter(
    (f) => body[f] !== undefined
  );
  if (dateFields.length > 0) {
    const check = parseDateFields(body, dateFields);
    if (!check.ok) {
      return NextResponse.json(
        {
          error: `The "${check.label}" field has an invalid date. Please pick a valid date and time and try again.`,
          field: check.field,
        },
        { status: 400 }
      );
    }
    if ("assessmentDate" in check.values) {
      data.assessmentDate = check.values.assessmentDate;
    }
    if ("createdAt" in check.values) {
      // undefined skips the write so an explicit null (clear) isn't mistaken
      // for "no change"; a null createdAt would violate the required column.
      data.createdAt = check.values.createdAt ?? undefined;
    }
  }
  if (typeof body.subjectId === "string") data.subjectId = body.subjectId;
  if (typeof body.batchId === "string") data.batchId = body.batchId;

  if (Object.keys(data).length === 0) {
    return NextResponse.json({ error: "No valid fields to update" }, { status: 400 });
  }

  await db.assessment.update({ where: { id }, data });

  return NextResponse.json({ success: true });
}
