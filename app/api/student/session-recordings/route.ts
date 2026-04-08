import { NextResponse } from "next/server";
import { requireStudentPortal } from "@/lib/api-auth";
import { db } from "@/lib/db";

export const runtime = "nodejs";

export async function GET(req: Request) {
  const gate = await requireStudentPortal();
  if (!gate.ok) return gate.response;

  const { searchParams } = new URL(req.url);
  const programId = searchParams.get("programId");
  if (!programId) return NextResponse.json({ error: "programId is required" }, { status: 400 });

  const enrollment = await db.programEnrollment.findFirst({
    where: { userId: gate.session.user.id, programId, status: { in: ["ENROLLED", "COMPLETED", "GRADUATED"] } },
  });
  if (!enrollment) {
    const profile = await db.studentProfile.findFirst({
      where: { userId: gate.session.user.id, programId },
    });
    if (!profile) return NextResponse.json({ error: "Not enrolled in this program" }, { status: 403 });
  }

  const recordings = await db.sessionRecording.findMany({
    where: { programId },
    orderBy: { sessionDate: "desc" },
    include: { uploadedBy: { select: { firstName: true, lastName: true } } },
  });

  return NextResponse.json({ recordings });
}
