import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { StudentSubmissionKind } from "@/app/generated/prisma/client";
import { NextResponse } from "next/server";

type AutoItem = {
  studentName: string;
  fileName: string;
  fileUrl: string | null;
  contentType: string;
  fileSize: number;
  status: "uploaded" | "pending";
  amount?: number;
  uploadedAt?: string | null;
  /** User id — for principal replace/delete on binder sources */
  studentUserId?: string;
  binderKind?: "signed_contract" | "photo_id" | "fee_proof" | "fee_payment";
  feePaymentId?: string | null;
  /** Principal may replace/remove this row (latest in its chain) */
  canManage?: boolean;
};

type StudentGroup = { studentName: string; items: AutoItem[] };

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
    return NextResponse.json({ autoFiles: [], byStudent: [] });
  }

  switch (folder.autoPopulateKey) {
    case "signed_contracts": {
      const byStudent = await getSignedContractsGrouped(folder.batchId);
      const autoFiles = flattenGroups(byStudent);
      return NextResponse.json({ autoFiles, byStudent });
    }

    case "photo_ids": {
      const byStudent = await getPhotoIdsGrouped(folder.batchId);
      const autoFiles = flattenGroups(byStudent);
      return NextResponse.json({ autoFiles, byStudent });
    }

    case "payment_receipts": {
      const byStudent = await getPaymentReceiptsGrouped(folder.batchId);
      return NextResponse.json({ autoFiles: flattenGroups(byStudent), byStudent });
    }

    case "pre_admission": {
      const files = await getPreAdmissionResults(folder.batchId);
      return NextResponse.json({
        autoFiles: files,
        byStudent: [],
      });
    }

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
      return NextResponse.json({ autoFiles: [], byStudent: [] });
  }
}

function guessContentType(fileName: string): string {
  const lower = fileName.toLowerCase();
  if (lower.endsWith(".pdf")) return "application/pdf";
  if (lower.endsWith(".png")) return "image/png";
  if (lower.endsWith(".jpg") || lower.endsWith(".jpeg")) return "image/jpeg";
  return "application/octet-stream";
}

function flattenGroups(byStudent: StudentGroup[]): AutoItem[] {
  return byStudent.flatMap((g) => g.items);
}

/** Merge chronological submission logs with current onboarding/payment file (deduped). */
function mergeSubmissionTrail(
  logs: { fileUrl: string; fileName: string; createdAt: Date }[],
  current: { url: string | null; fileName: string | null; at: Date | null },
): Array<{
  fileUrl: string;
  fileName: string;
  uploadedAt: Date;
  canManage: boolean;
}> {
  const rows = logs.map((l) => ({
    fileUrl: l.fileUrl,
    fileName: l.fileName,
    uploadedAt: l.createdAt,
    canManage: false,
  }));
  if (current.url) {
    const last = rows[rows.length - 1];
    if (!last || last.fileUrl !== current.url) {
      rows.push({
        fileUrl: current.url,
        fileName: current.fileName ?? "file",
        uploadedAt: current.at ?? new Date(),
        canManage: false,
      });
    }
  }
  if (rows.length) {
    const last = rows[rows.length - 1];
    rows[rows.length - 1] = { ...last, canManage: true };
  }
  return rows;
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

async function getSignedContractsGrouped(
  batchId: string | null,
): Promise<StudentGroup[]> {
  const students = await getStudentsInBatch(batchId);
  const results: StudentGroup[] = [];

  for (const student of students) {
    const studentName =
      `${student.user.firstName ?? ""} ${student.user.lastName ?? ""}`.trim();
    const uid = student.user.id;

    const logs = await db.studentSubmissionLog.findMany({
      where: {
        studentProfileId: student.id,
        kind: StudentSubmissionKind.SIGNED_CONTRACT,
      },
      orderBy: { createdAt: "asc" },
    });

    const onboarding = await db.studentOnboarding.findUnique({
      where: { userId: uid },
    });

    const trail = mergeSubmissionTrail(
      logs.map((l) => ({
        fileUrl: l.fileUrl,
        fileName: l.fileName,
        createdAt: l.createdAt,
      })),
      {
        url: onboarding?.signedContractUploadUrl ?? null,
        fileName: onboarding?.signedContractFileName ?? null,
        at: onboarding?.contractAcknowledgedAt ?? null,
      },
    );

    const items: AutoItem[] =
      trail.length === 0
        ? [
            {
              studentName,
              studentUserId: uid,
              binderKind: "signed_contract",
              fileName: "Pending",
              fileUrl: null,
              contentType: "application/octet-stream",
              fileSize: 0,
              status: "pending",
            },
          ]
        : trail.map((t) => ({
            studentName,
            studentUserId: uid,
            binderKind: "signed_contract" as const,
            fileName: t.fileName,
            fileUrl: t.fileUrl,
            contentType: guessContentType(t.fileName),
            fileSize: 0,
            status: "uploaded" as const,
            uploadedAt: t.uploadedAt.toISOString(),
            canManage: t.canManage,
          }));

    results.push({ studentName, items });
  }

  return results;
}

async function getPhotoIdsGrouped(batchId: string | null): Promise<StudentGroup[]> {
  const students = await getStudentsInBatch(batchId);
  const results: StudentGroup[] = [];

  for (const student of students) {
    const studentName =
      `${student.user.firstName ?? ""} ${student.user.lastName ?? ""}`.trim();
    const uid = student.user.id;

    const logs = await db.studentSubmissionLog.findMany({
      where: {
        studentProfileId: student.id,
        kind: StudentSubmissionKind.GOVERNMENT_ID,
      },
      orderBy: { createdAt: "asc" },
    });

    const onboarding = await db.studentOnboarding.findUnique({
      where: { userId: uid },
    });

    const trail = mergeSubmissionTrail(
      logs.map((l) => ({
        fileUrl: l.fileUrl,
        fileName: l.fileName,
        createdAt: l.createdAt,
      })),
      {
        url: onboarding?.governmentIdUploadUrl ?? null,
        fileName: onboarding?.governmentIdFileName ?? null,
        at: onboarding?.governmentIdsUploadedAt ?? null,
      },
    );

    const items: AutoItem[] =
      trail.length === 0
        ? [
            {
              studentName,
              studentUserId: uid,
              binderKind: "photo_id",
              fileName: "Pending",
              fileUrl: null,
              contentType: "application/octet-stream",
              fileSize: 0,
              status: "pending",
            },
          ]
        : trail.map((t) => ({
            studentName,
            studentUserId: uid,
            binderKind: "photo_id" as const,
            fileName: t.fileName,
            fileUrl: t.fileUrl,
            contentType: guessContentType(t.fileName),
            fileSize: 0,
            status: "uploaded" as const,
            uploadedAt: t.uploadedAt.toISOString(),
            canManage: t.canManage,
          }));

    results.push({ studentName, items });
  }

  return results;
}

async function getPaymentReceiptsGrouped(
  batchId: string | null,
): Promise<StudentGroup[]> {
  const students = await getStudentsInBatch(batchId);
  const results: StudentGroup[] = [];

  for (const student of students) {
    const studentName =
      `${student.user.firstName ?? ""} ${student.user.lastName ?? ""}`.trim();
    const uid = student.user.id;

    const items: AutoItem[] = [];

    const onboarding = await db.studentOnboarding.findUnique({
      where: { userId: uid },
    });

    const feeProofLogs = await db.studentSubmissionLog.findMany({
      where: {
        studentProfileId: student.id,
        kind: StudentSubmissionKind.ONBOARDING_FEE_PROOF,
      },
      orderBy: { createdAt: "asc" },
    });

    const feeProofTrail = mergeSubmissionTrail(
      feeProofLogs.map((l) => ({
        fileUrl: l.fileUrl,
        fileName: l.fileName,
        createdAt: l.createdAt,
      })),
      {
        url: onboarding?.feeProofUploadUrl ?? null,
        fileName: onboarding?.feeProofFileName ?? null,
        at: onboarding?.feeProofUploadedAt ?? null,
      },
    );

    for (const t of feeProofTrail) {
      items.push({
        studentName,
        studentUserId: uid,
        binderKind: "fee_proof",
        fileName: t.fileName,
        fileUrl: t.fileUrl,
        contentType: guessContentType(t.fileName),
        fileSize: 0,
        status: "uploaded",
        uploadedAt: t.uploadedAt.toISOString(),
        canManage: t.canManage,
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
      if (!payment.receiptUrl) continue;

      const payLogs = await db.studentSubmissionLog.findMany({
        where: {
          studentProfileId: student.id,
          kind: StudentSubmissionKind.FEE_RECEIPT,
          feePaymentId: payment.id,
        },
        orderBy: { createdAt: "asc" },
      });

      const payTrail = mergeSubmissionTrail(
        payLogs.map((l) => ({
          fileUrl: l.fileUrl,
          fileName: l.fileName,
          createdAt: l.createdAt,
        })),
        {
          url: payment.receiptUrl,
          fileName: payment.receiptFileName,
          at: payment.paymentDate,
        },
      );

      for (const t of payTrail) {
        items.push({
          studentName,
          studentUserId: uid,
          binderKind: "fee_payment",
          feePaymentId: payment.id,
          fileName: t.fileName,
          fileUrl: t.fileUrl,
          contentType: guessContentType(t.fileName),
          fileSize: 0,
          status: "uploaded",
          amount: payment.amountPaid,
          uploadedAt: t.uploadedAt.toISOString(),
          canManage: t.canManage,
        });
      }
    }

    if (items.length === 0) {
      items.push({
        studentName,
        studentUserId: uid,
        binderKind: "fee_proof",
        fileName: "Pending",
        fileUrl: null,
        contentType: "application/octet-stream",
        fileSize: 0,
        status: "pending",
      });
    }

    results.push({ studentName, items });
  }

  return results;
}

async function getPreAdmissionResults(batchId: string | null) {
  const students = await getStudentsInBatch(batchId);
  const results: AutoItem[] = [];

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
          fileName: `${attempt.assessment.title} — ${attempt.percentage ?? 0}%`,
          fileUrl: null,
          contentType: "text/plain",
          fileSize: 0,
          status: "uploaded",
          uploadedAt: onboarding.preAdmissionCompletedAt.toISOString(),
        });
      } else {
        results.push({
          studentName,
          fileName: "Pre-admission completed",
          fileUrl: null,
          contentType: "text/plain",
          fileSize: 0,
          status: "uploaded",
          uploadedAt: onboarding.preAdmissionCompletedAt.toISOString(),
        });
      }
    } else {
      results.push({
        studentName,
        fileName: "Pending",
        fileUrl: null,
        contentType: "application/octet-stream",
        fileSize: 0,
        status: "pending",
      });
    }
  }

  return results;
}
