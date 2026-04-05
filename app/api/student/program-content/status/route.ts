import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { hasStudentPortalAccess } from "@/lib/portal-access";
import {
  countIncompleteProgramContentItems,
  isProgramContentCompleteForStudent,
} from "@/lib/program-content";
import { NextResponse } from "next/server";

export const runtime = "nodejs";

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!hasStudentPortalAccess(session)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const profile = await db.studentProfile.findUnique({
    where: { userId: session.user.id },
    include: { program: true },
  });

  if (!profile?.programId) {
    return NextResponse.json({
      programId: null,
      incompleteLessons: 0,
      totalLessons: 0,
      eligibleForCertificate: false,
      certificateSent: false,
    });
  }

  const { total, incomplete } = await countIncompleteProgramContentItems(
    session.user.id,
    profile.programId
  );
  const eligible = await isProgramContentCompleteForStudent(session.user.id, profile.programId);
  const sent = await db.programCertificateSend.findUnique({
    where: {
      programId_studentUserId: {
        programId: profile.programId,
        studentUserId: session.user.id,
      },
    },
  });

  return NextResponse.json({
    programId: profile.programId,
    programName: profile.program?.name,
    incompleteLessons: incomplete,
    totalLessons: total,
    eligibleForCertificate: eligible,
    certificateSent: !!sent,
  });
}
