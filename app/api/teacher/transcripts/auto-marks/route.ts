import { requireTeacherPortal } from "@/lib/api-auth";
import { computeAutoMarks } from "@/lib/transcript";
import { NextResponse } from "next/server";

export async function GET(req: Request) {
  const gate = await requireTeacherPortal();
  if (!gate.ok) return gate.response;

  const { searchParams } = new URL(req.url);
  const studentId = searchParams.get("studentId");
  const programId = searchParams.get("programId");
  if (!studentId || !programId) return NextResponse.json({ error: "studentId and programId required" }, { status: 400 });

  const marks = await computeAutoMarks(studentId, programId);
  return NextResponse.json({ marks });
}
