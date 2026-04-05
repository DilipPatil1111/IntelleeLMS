import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { NextResponse } from "next/server";

export const runtime = "nodejs";

export async function GET(req: Request) {
  const session = await auth();
  if (!session?.user || session.user.role !== "PRINCIPAL") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { searchParams } = new URL(req.url);
  const programId = searchParams.get("programId") || undefined;
  const batchId = searchParams.get("batchId") || undefined;

  const where: Record<string, unknown> = {};
  if (programId) where.programId = programId;
  if (batchId) where.batchId = batchId;

  const students = await db.studentProfile.findMany({
    where,
    include: {
      user: { select: { id: true, firstName: true, lastName: true, email: true } },
      program: { include: { feeStructures: { select: { id: true, totalAmount: true } } } },
      batch: { select: { id: true, name: true } },
      feePayments: {
        select: {
          id: true,
          amountPaid: true,
          receiptUrl: true,
          receiptFileName: true,
          confirmedAt: true,
        },
      },
    },
  });

  const onboardingRecords = await db.studentOnboarding.findMany({
    where: {
      userId: { in: students.map((s) => s.userId) },
    },
    select: {
      userId: true,
      feeProofUploadUrl: true,
      feeProofFileName: true,
    },
  });

  const onboardingByUserId = new Map(onboardingRecords.map((o) => [o.userId, o]));

  const result = students.map((sp) => {
    const totalFees = sp.program?.feeStructures.reduce((sum, fs) => sum + fs.totalAmount, 0) ?? 0;
    const totalPaid = sp.feePayments.reduce((sum, fp) => sum + fp.amountPaid, 0);
    const pendingAmount = totalFees - totalPaid;
    const onboarding = onboardingByUserId.get(sp.userId);

    const receipts = sp.feePayments
      .filter((fp) => fp.receiptUrl)
      .map((fp) => ({
        id: fp.id,
        fileName: fp.receiptFileName,
        fileUrl: fp.receiptUrl,
        amountPaid: fp.amountPaid,
        confirmed: !!fp.confirmedAt,
      }));

    if (onboarding?.feeProofUploadUrl) {
      receipts.unshift({
        id: `onboarding-${sp.userId}`,
        fileName: onboarding.feeProofFileName ?? "Fee proof (onboarding)",
        fileUrl: onboarding.feeProofUploadUrl,
        amountPaid: 0,
        confirmed: false,
      });
    }

    return {
      studentId: sp.id,
      userId: sp.userId,
      name: `${sp.user.firstName} ${sp.user.lastName}`,
      email: sp.user.email,
      programName: sp.program?.name ?? null,
      batchName: sp.batch?.name ?? null,
      totalFees,
      totalPaid,
      pendingAmount,
      receipts,
    };
  });

  return NextResponse.json(result);
}
