import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { NextResponse } from "next/server";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const session = await auth();
  if (session?.user?.role !== "PRINCIPAL") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const folder = await db.docFolder.findUnique({ where: { id } });
  if (!folder) {
    return NextResponse.json({ error: "Folder not found" }, { status: 404 });
  }

  if (!folder.autoPopulateKey) {
    return NextResponse.json({ files: [] });
  }

  switch (folder.autoPopulateKey) {
    case "signed_contracts":
      return NextResponse.json({
        files: await getSignedContracts(folder.batchId),
      });

    case "photo_ids":
      return NextResponse.json({
        files: await getPhotoIds(folder.batchId),
      });

    case "payment_receipts":
      return NextResponse.json({
        files: await getPaymentReceipts(folder.batchId),
      });

    case "pre_admission":
      return NextResponse.json({
        files: await getPreAdmissionResults(folder.batchId),
      });

    case "attendance":
      return NextResponse.json({
        type: "link",
        url: `/principal/attendance?batchId=${folder.batchId}`,
      });

    case "transcripts":
      return NextResponse.json({
        type: "placeholder",
        message:
          "Coming soon — transcript generation will be available in a future update",
      });

    default:
      return NextResponse.json({ files: [] });
  }
}

async function getStudentsInBatch(batchId: string | null) {
  if (!batchId) return [];
  return db.studentProfile.findMany({
    where: { batchId },
    include: {
      user: { select: { id: true, firstName: true, lastName: true } },
    },
  });
}

async function getSignedContracts(batchId: string | null) {
  const students = await getStudentsInBatch(batchId);
  const results = [];

  for (const student of students) {
    const studentName =
      `${student.user.firstName ?? ""} ${student.user.lastName ?? ""}`.trim();
    const onboarding = await db.studentOnboarding.findUnique({
      where: { userId: student.user.id },
    });

    if (onboarding?.signedContractUploadUrl) {
      results.push({
        studentName,
        fileUrl: onboarding.signedContractUploadUrl,
        fileName:
          onboarding.signedContractFileName ??
          `${studentName} - Signed Contract`,
        uploadedAt: onboarding.contractAcknowledgedAt,
      });
    } else {
      results.push({ studentName, pending: true });
    }
  }

  return results;
}

async function getPhotoIds(batchId: string | null) {
  const students = await getStudentsInBatch(batchId);
  const results = [];

  for (const student of students) {
    const studentName =
      `${student.user.firstName ?? ""} ${student.user.lastName ?? ""}`.trim();
    const onboarding = await db.studentOnboarding.findUnique({
      where: { userId: student.user.id },
    });

    if (onboarding?.governmentIdUploadUrl) {
      results.push({
        studentName,
        fileUrl: onboarding.governmentIdUploadUrl,
        fileName:
          onboarding.governmentIdFileName ??
          `${studentName} - Government ID`,
        uploadedAt: onboarding.governmentIdsUploadedAt,
      });
    } else {
      results.push({ studentName, pending: true });
    }
  }

  return results;
}

async function getPaymentReceipts(batchId: string | null) {
  const students = await getStudentsInBatch(batchId);
  const results = [];

  for (const student of students) {
    const studentName =
      `${student.user.firstName ?? ""} ${student.user.lastName ?? ""}`.trim();

    const receipts: Array<{
      fileUrl: string;
      fileName: string;
      amount?: number;
      uploadedAt: Date | null;
    }> = [];

    const onboarding = await db.studentOnboarding.findUnique({
      where: { userId: student.user.id },
    });

    if (onboarding?.feeProofUploadUrl) {
      receipts.push({
        fileUrl: onboarding.feeProofUploadUrl,
        fileName:
          onboarding.feeProofFileName ?? `${studentName} - Fee Proof`,
        uploadedAt: onboarding.feeProofUploadedAt,
      });
    }

    const feePayments = await db.feePayment.findMany({
      where: {
        studentProfileId: student.id,
        receiptUrl: { not: null },
      },
      orderBy: { createdAt: "desc" },
    });

    for (const payment of feePayments) {
      if (payment.receiptUrl) {
        receipts.push({
          fileUrl: payment.receiptUrl,
          fileName:
            payment.receiptFileName ??
            `${studentName} - Payment Receipt`,
          amount: payment.amountPaid,
          uploadedAt: payment.createdAt,
        });
      }
    }

    results.push({
      studentName,
      receipts,
      pending: receipts.length === 0,
    });
  }

  return results;
}

async function getPreAdmissionResults(batchId: string | null) {
  const students = await getStudentsInBatch(batchId);
  const results = [];

  for (const student of students) {
    const studentName =
      `${student.user.firstName ?? ""} ${student.user.lastName ?? ""}`.trim();
    const onboarding = await db.studentOnboarding.findUnique({
      where: { userId: student.user.id },
    });

    if (onboarding?.preAdmissionCompletedAt) {
      const attempt = await db.attempt.findFirst({
        where: {
          studentId: student.user.id,
          assessment: {
            id: onboarding.preAdmissionAssessmentId ?? undefined,
          },
        },
        include: {
          assessment: { select: { title: true } },
        },
        orderBy: { createdAt: "desc" },
      });

      if (attempt) {
        results.push({
          studentName,
          assessmentTitle: attempt.assessment.title,
          score: attempt.totalScore ?? 0,
          percentage: attempt.percentage ?? 0,
          completedAt: onboarding.preAdmissionCompletedAt,
        });
      } else {
        results.push({
          studentName,
          completedAt: onboarding.preAdmissionCompletedAt,
          pending: false,
        });
      }
    } else {
      results.push({ studentName, pending: true });
    }
  }

  return results;
}
