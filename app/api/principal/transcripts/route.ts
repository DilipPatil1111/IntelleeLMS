import { requirePrincipalPortal } from "@/lib/api-auth";
import { db } from "@/lib/db";
import { computeAutoMarks, computeOverallAvg, finalPct, resolveGrade } from "@/lib/transcript";
import { NextResponse } from "next/server";

export async function GET(req: Request) {
  const gate = await requirePrincipalPortal();
  if (!gate.ok) return gate.response;

  const { searchParams } = new URL(req.url);
  const status = searchParams.get("status") || undefined;

  const transcripts = await db.transcript.findMany({
    where: status ? { status: status as "DRAFT" | "PUBLISHED" } : undefined,
    include: {
      student: { select: { firstName: true, lastName: true, studentProfile: { select: { enrollmentNo: true } } } },
      program: { select: { name: true } },
      batch: { select: { name: true } },
      createdBy: { select: { firstName: true, lastName: true } },
      _count: { select: { subjects: true } },
    },
    orderBy: { updatedAt: "desc" },
  });

  return NextResponse.json({ transcripts });
}

export async function POST(req: Request) {
  const gate = await requirePrincipalPortal();
  if (!gate.ok) return gate.response;

  const body = await req.json();
  const { studentId, programId, batchId, totalHours, startDate, endDate, standing, credential, remarks, subjects } = body;

  if (!studentId || !programId) {
    return NextResponse.json({ error: "studentId and programId are required" }, { status: 400 });
  }

  const bands = await db.gradeBand.findMany({ orderBy: { sortOrder: "asc" } });

  const subjectData = (subjects as Array<{
    subjectCode?: string; subjectName: string; description?: string;
    autoMarksPct?: number | null; manualMarksPct?: number | null; sortOrder?: number;
  }> || []).map((s, i) => {
    const fp = finalPct(s);
    return {
      subjectCode: s.subjectCode || null,
      subjectName: s.subjectName,
      description: s.description || null,
      autoMarksPct: s.autoMarksPct ?? null,
      manualMarksPct: s.manualMarksPct ?? null,
      finalMarksPct: fp,
      grade: resolveGrade(fp, bands),
      sortOrder: s.sortOrder ?? i,
    };
  });

  const overallAvgPct = computeOverallAvg(subjectData);

  const transcript = await db.transcript.create({
    data: {
      studentId,
      programId,
      batchId: batchId || null,
      totalHours: totalHours ? Number(totalHours) : null,
      startDate: startDate ? new Date(startDate) : null,
      endDate: endDate ? new Date(endDate) : null,
      standing: standing || null,
      credential: credential || null,
      remarks: remarks || null,
      overallAvgPct,
      createdById: gate.session.user.id,
      subjects: { create: subjectData },
    },
    include: { subjects: true },
  });

  return NextResponse.json({ transcript }, { status: 201 });
}
