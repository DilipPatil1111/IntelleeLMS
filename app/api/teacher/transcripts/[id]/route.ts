import { requireTeacherPortal } from "@/lib/api-auth";
import { db } from "@/lib/db";
import { computeOverallAvg, finalPct, getTranscriptById, resolveGrade } from "@/lib/transcript";
import { NextResponse } from "next/server";

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const gate = await requireTeacherPortal();
  if (!gate.ok) return gate.response;
  const { id } = await params;

  const [transcript, bands] = await Promise.all([
    getTranscriptById(id),
    db.gradeBand.findMany({ orderBy: { sortOrder: "asc" } }),
  ]);
  if (!transcript) return NextResponse.json({ error: "Not found" }, { status: 404 });

  // Always return live-computed grades from current grade bands.
  // Use stored finalMarksPct (the definitive value) — not re-derived from auto/manual fields.
  const fresh = {
    ...transcript,
    subjects: transcript.subjects.map((s) => ({
      ...s,
      grade: resolveGrade(s.finalMarksPct, bands),
    })),
  };
  return NextResponse.json({ transcript: fresh });
}

export async function PUT(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const gate = await requireTeacherPortal();
  if (!gate.ok) return gate.response;
  const { id } = await params;

  const existing = await db.transcript.findUnique({ where: { id }, select: { status: true, createdById: true } });
  if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (existing.createdById !== gate.session.user.id) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  if (existing.status === "PUBLISHED") return NextResponse.json({ error: "Published transcripts cannot be edited" }, { status: 400 });

  const body = await req.json();
  const { totalHours, startDate, endDate, standing, credential, remarks, subjects } = body;
  const bands = await db.gradeBand.findMany({ orderBy: { sortOrder: "asc" } });

  const subjectData = (subjects as Array<{
    subjectCode?: string; subjectName: string; description?: string;
    autoMarksPct?: number | null; manualMarksPct?: number | null; sortOrder?: number;
  }> || []).map((s, i) => {
    const fp = finalPct(s);
    return {
      subjectCode: s.subjectCode || null, subjectName: s.subjectName,
      description: s.description || null, autoMarksPct: s.autoMarksPct ?? null,
      manualMarksPct: s.manualMarksPct ?? null, finalMarksPct: fp,
      grade: resolveGrade(fp, bands), sortOrder: s.sortOrder ?? i,
    };
  });

  await db.transcriptSubjectRow.deleteMany({ where: { transcriptId: id } });
  const transcript = await db.transcript.update({
    where: { id },
    data: {
      totalHours: totalHours ? Number(totalHours) : null,
      startDate: startDate ? new Date(startDate) : null,
      endDate: endDate ? new Date(endDate) : null,
      standing: standing || null, credential: credential || null, remarks: remarks || null,
      overallAvgPct: computeOverallAvg(subjectData),
      subjects: { create: subjectData },
    },
    include: { subjects: true },
  });
  return NextResponse.json({ transcript });
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const gate = await requireTeacherPortal();
  if (!gate.ok) return gate.response;
  const { id } = await params;
  const existing = await db.transcript.findUnique({ where: { id }, select: { createdById: true } });
  if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (existing.createdById !== gate.session.user.id) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  await db.transcript.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
