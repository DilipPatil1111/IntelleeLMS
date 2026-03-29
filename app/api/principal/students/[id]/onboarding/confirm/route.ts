import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { notifyStudentStatusChange } from "@/lib/student-status";
import { NextResponse } from "next/server";

export const runtime = "nodejs";

export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const role = (session.user as unknown as Record<string, unknown>).role as string;
  if (role !== "PRINCIPAL") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { id: studentUserId } = await params;

  const profile = await db.studentProfile.findUnique({ where: { userId: studentUserId } });
  if (!profile) return NextResponse.json({ error: "Student not found" }, { status: 404 });

  const previousStatus = profile.status;

  await db.$transaction(async (tx) => {
    await tx.studentOnboarding.upsert({
      where: { userId: studentUserId },
      update: { principalConfirmedAt: new Date() },
      create: { userId: studentUserId, principalConfirmedAt: new Date() },
    });

    if (previousStatus === "ACCEPTED") {
      await tx.studentProfile.update({
        where: { userId: studentUserId },
        data: { status: "ENROLLED" },
      });
    }

    if (profile.programId) {
      await tx.programApplication.updateMany({
        where: { applicantId: studentUserId, programId: profile.programId },
        data: { status: "ENROLLED" },
      });
    }
  });

  if (previousStatus === "ACCEPTED") {
    try {
      await notifyStudentStatusChange(studentUserId, "ACCEPTED", "ENROLLED");
    } catch (e) {
      console.error("notifyStudentStatusChange after onboarding confirm", e);
    }
  }

  return NextResponse.json({ success: true });
}
