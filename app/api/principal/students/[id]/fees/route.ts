import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { NextResponse } from "next/server";

export const runtime = "nodejs";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user || session.user.role !== "PRINCIPAL") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id: userId } = await params;

  const profile = await db.studentProfile.findUnique({
    where: { userId },
    include: {
      user: { select: { id: true, firstName: true, lastName: true, email: true } },
      program: { include: { feeStructures: true } },
      batch: { select: { id: true, name: true } },
      feePayments: {
        orderBy: { paymentDate: "desc" },
      },
    },
  });

  if (!profile) {
    return NextResponse.json({ error: "Student not found" }, { status: 404 });
  }

  const onboarding = await db.studentOnboarding.findUnique({
    where: { userId },
    select: {
      feeProofUploadUrl: true,
      feeProofFileName: true,
      feeProofUploadedAt: true,
    },
  });

  const totalFees = profile.program?.feeStructures.reduce((sum, fs) => sum + fs.totalAmount, 0) ?? 0;
  const totalPaid = profile.feePayments.reduce((sum, fp) => sum + fp.amountPaid, 0);
  const pendingAmount = totalFees - totalPaid;

  return NextResponse.json({
    studentId: profile.id,
    userId: profile.userId,
    name: `${profile.user.firstName} ${profile.user.lastName}`,
    email: profile.user.email,
    programName: profile.program?.name ?? null,
    batchName: profile.batch?.name ?? null,
    totalFees,
    totalPaid,
    pendingAmount,
    feeStructures: profile.program?.feeStructures.map((fs) => ({
      id: fs.id,
      name: fs.name,
      totalAmount: fs.totalAmount,
      dueDate: fs.dueDate,
      term: fs.term,
    })) ?? [],
    payments: profile.feePayments.map((fp) => ({
      id: fp.id,
      amountPaid: fp.amountPaid,
      paymentDate: fp.paymentDate,
      paymentMethod: fp.paymentMethod,
      transactionRef: fp.transactionRef,
      notes: fp.notes,
      receiptUrl: fp.receiptUrl,
      receiptFileName: fp.receiptFileName,
      confirmedAt: fp.confirmedAt,
      confirmedById: fp.confirmedById,
    })),
    onboardingFeeProof: onboarding?.feeProofUploadUrl
      ? {
          fileUrl: onboarding.feeProofUploadUrl,
          fileName: onboarding.feeProofFileName,
          uploadedAt: onboarding.feeProofUploadedAt,
        }
      : null,
  });
}
