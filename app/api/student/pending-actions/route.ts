import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { studentVisibleAssessmentFilter } from "@/lib/assessment-assigned-students";

export async function GET() {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const user = await db.user.findUnique({
    where: { id: session.user.id },
    include: {
      studentProfile: {
        include: {
          program: { include: { feeStructures: true } },
          feePayments: {
            include: { feeStructure: true },
            orderBy: { paymentDate: "desc" },
          },
        },
      },
    },
  });

  if (!user?.studentProfile) {
    return NextResponse.json({ error: "Student profile not found" }, { status: 404 });
  }

  const profile = user.studentProfile;
  const batchId = profile.batchId;

  // --- Pending Assessments ---
  let pendingAssessments: {
    id: string;
    title: string;
    subjectName: string;
    type: string;
    scheduledCloseAt: string | null;
    status: "NOT_STARTED" | "IN_PROGRESS";
  }[] = [];

  if (batchId) {
    try {
      const assessments = await db.assessment.findMany({
        where: {
          status: "PUBLISHED",
          AND: [studentVisibleAssessmentFilter(user.id, batchId)],
        },
        include: {
          subject: true,
          attempts: { where: { studentId: user.id } },
        },
        orderBy: { scheduledCloseAt: "asc" },
      });

      pendingAssessments = assessments
        .filter((a) => {
          const attempt = a.attempts[0];
          return !attempt || attempt.status === "IN_PROGRESS";
        })
        .map((a) => ({
          id: a.id,
          title: a.title,
          subjectName: a.subject?.name ?? "",
          type: a.type,
          scheduledCloseAt: a.scheduledCloseAt?.toISOString() ?? null,
          status: a.attempts[0]?.status === "IN_PROGRESS" ? ("IN_PROGRESS" as const) : ("NOT_STARTED" as const),
        }));
    } catch (err) {
      console.error("[pending-actions] assessment query fallback:", err);
    }
  }

  // --- Pending Documents ---
  const onboarding = await db.studentOnboarding.findUnique({
    where: { userId: user.id },
  });

  const documents = onboarding
    ? [
        {
          key: "contract",
          label: "Signed student agreement",
          step: "contract" as const,
          completed: !!onboarding.contractAcknowledgedAt,
          uploadedAt: onboarding.contractAcknowledgedAt?.toISOString() ?? null,
          fileName: onboarding.signedContractFileName ?? null,
          fileUrl: onboarding.signedContractUploadUrl ?? null,
        },
        {
          key: "ids",
          label: "Government photo ID",
          step: "ids" as const,
          completed: !!onboarding.governmentIdsUploadedAt,
          uploadedAt: onboarding.governmentIdsUploadedAt?.toISOString() ?? null,
          fileName: onboarding.governmentIdFileName ?? null,
          fileUrl: onboarding.governmentIdUploadUrl ?? null,
        },
        {
          key: "fee",
          label: "Fee payment proof",
          step: "fee" as const,
          completed: !!onboarding.feeProofUploadedAt,
          uploadedAt: onboarding.feeProofUploadedAt?.toISOString() ?? null,
          fileName: onboarding.feeProofFileName ?? null,
          fileUrl: onboarding.feeProofUploadUrl ?? null,
        },
      ]
    : null;

  // --- Pending Fees ---
  const totalFees =
    profile.program?.feeStructures.reduce((sum, fs) => sum + fs.totalAmount, 0) ?? 0;
  const totalPaid = profile.feePayments.reduce((sum, fp) => sum + fp.amountPaid, 0);
  const pendingAmount = totalFees - totalPaid;

  const receipts = profile.feePayments
    .filter((fp) => fp.receiptUrl)
    .map((fp) => ({
      id: fp.id,
      fileName: fp.receiptFileName ?? "receipt",
      fileUrl: fp.receiptUrl!,
      amountPaid: fp.amountPaid,
      paymentDate: fp.paymentDate.toISOString(),
      confirmed: !!fp.confirmedAt,
    }));

  const pendingDocCount = documents?.filter((d) => !d.completed).length ?? 0;

  return NextResponse.json({
    pendingAssessments,
    documents,
    fees: {
      totalFees,
      totalPaid,
      pendingAmount,
      receipts,
    },
    counts: {
      assessments: pendingAssessments.length,
      documents: pendingDocCount,
      fees: pendingAmount > 0 ? 1 : 0,
      total: pendingAssessments.length + pendingDocCount + (pendingAmount > 0 ? 1 : 0),
    },
  });
}
