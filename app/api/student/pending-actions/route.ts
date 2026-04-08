import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { studentVisibleAssessmentFilter } from "@/lib/assessment-assigned-students";
import { StudentSubmissionKind } from "@/app/generated/prisma/client";

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
          batch: {
            include: {
              subjects: true,
            },
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

  // --- Pending Assessments (incomplete) ---
  let pendingAssessments: {
    id: string;
    title: string;
    subjectName: string;
    type: string;
    scheduledCloseAt: string | null;
    status: "NOT_STARTED" | "IN_PROGRESS";
    priority: "HIGH" | "NORMAL";
  }[] = [];

  // --- Below-passing assessment results ---
  let belowPassingResults: {
    id: string;
    title: string;
    subjectName: string;
    type: string;
    score: number;
    totalMarks: number;
    passingMarks: number;
    priority: "HIGH";
    message: string;
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
          priority: "HIGH" as const,
        }));

      belowPassingResults = assessments
        .filter((a) => {
          const attempt = a.attempts[0];
          if (!attempt || attempt.status !== "SUBMITTED" && attempt.status !== "GRADED") return false;
          const totalMarks = a.totalMarks ?? 0;
          if (totalMarks <= 0) return false;
          const passingMarks = a.passingMarks ?? Math.round(totalMarks * 0.4);
          return (attempt.totalScore ?? 0) < passingMarks;
        })
        .map((a) => {
          const attempt = a.attempts[0];
          const totalMarks = a.totalMarks ?? 0;
          const passingMarks = a.passingMarks ?? Math.round(totalMarks * 0.4);
          return {
            id: a.id,
            title: a.title,
            subjectName: a.subject?.name ?? "",
            type: a.type,
            score: attempt.totalScore ?? 0,
            totalMarks,
            passingMarks,
            priority: "HIGH" as const,
            message: "Please contact Principal/Administrator for further action.",
          };
        });
    } catch (err) {
      console.error("[pending-actions] assessment query fallback:", err);
    }
  }

  // --- Below-minimum attendance ---
  let attendanceAlerts: {
    subjectName: string;
    attendancePercent: number;
    requiredPercent: number;
    priority: "HIGH";
    message: string;
  }[] = [];

  if (batchId) {
    try {
      const attendanceRecords = await db.attendance.findMany({
        where: { studentId: user.id },
        include: { session: { include: { subject: true } } },
      });

      const bySubject = new Map<string, { present: number; total: number; name: string }>();
      for (const r of attendanceRecords) {
        const subName = r.session?.subject?.name ?? "Unknown";
        const subId = r.session?.subjectId ?? "unknown";
        const entry = bySubject.get(subId) ?? { present: 0, total: 0, name: subName };
        entry.total++;
        if (r.status === "PRESENT" || r.status === "LATE") entry.present++;
        bySubject.set(subId, entry);
      }

      const REQUIRED_PERCENT = 75;
      for (const [, data] of bySubject) {
        if (data.total === 0) continue;
        const pct = Math.round((data.present / data.total) * 100);
        if (pct < REQUIRED_PERCENT) {
          attendanceAlerts.push({
            subjectName: data.name,
            attendancePercent: pct,
            requiredPercent: REQUIRED_PERCENT,
            priority: "HIGH",
            message: "Please contact Principal/Administrator for further action.",
          });
        }
      }
    } catch (err) {
      console.error("[pending-actions] attendance alert fallback:", err);
    }
  }

  const submissionLogs = await db.studentSubmissionLog.findMany({
    where: { studentProfileId: profile.id },
    orderBy: { createdAt: "desc" },
  });

  const logsByKind = (k: StudentSubmissionKind) =>
    submissionLogs.filter((l) => l.kind === k).map((l) => ({
      fileUrl: l.fileUrl,
      fileName: l.fileName,
      uploadedAt: l.createdAt.toISOString(),
    }));

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
          trail: (() => {
            const fromLogs = logsByKind(StudentSubmissionKind.SIGNED_CONTRACT);
            if (fromLogs.length > 0) return fromLogs;
            if (onboarding.signedContractUploadUrl) {
              return [
                {
                  fileUrl: onboarding.signedContractUploadUrl,
                  fileName: onboarding.signedContractFileName ?? "document",
                  uploadedAt:
                    onboarding.contractAcknowledgedAt?.toISOString() ?? new Date().toISOString(),
                },
              ];
            }
            return [];
          })(),
        },
        {
          key: "ids",
          label: "Government photo ID",
          step: "ids" as const,
          completed: !!onboarding.governmentIdsUploadedAt,
          uploadedAt: onboarding.governmentIdsUploadedAt?.toISOString() ?? null,
          fileName: onboarding.governmentIdFileName ?? null,
          fileUrl: onboarding.governmentIdUploadUrl ?? null,
          trail: (() => {
            const fromLogs = logsByKind(StudentSubmissionKind.GOVERNMENT_ID);
            if (fromLogs.length > 0) return fromLogs;
            if (onboarding.governmentIdUploadUrl) {
              return [
                {
                  fileUrl: onboarding.governmentIdUploadUrl,
                  fileName: onboarding.governmentIdFileName ?? "document",
                  uploadedAt:
                    onboarding.governmentIdsUploadedAt?.toISOString() ?? new Date().toISOString(),
                },
              ];
            }
            return [];
          })(),
        },
        {
          key: "fee",
          label: "Fee payment proof",
          step: "fee" as const,
          completed: !!onboarding.feeProofUploadedAt,
          uploadedAt: onboarding.feeProofUploadedAt?.toISOString() ?? null,
          fileName: onboarding.feeProofFileName ?? null,
          fileUrl: onboarding.feeProofUploadUrl ?? null,
          trail: (() => {
            const fromLogs = logsByKind(StudentSubmissionKind.ONBOARDING_FEE_PROOF);
            if (fromLogs.length > 0) return fromLogs;
            if (onboarding.feeProofUploadUrl) {
              return [
                {
                  fileUrl: onboarding.feeProofUploadUrl,
                  fileName: onboarding.feeProofFileName ?? "document",
                  uploadedAt:
                    onboarding.feeProofUploadedAt?.toISOString() ?? new Date().toISOString(),
                },
              ];
            }
            return [];
          })(),
        },
      ]
    : null;

  // --- Pending Fees (multi-program) ---
  // Collect fee structures from all enrolled programs
  const enrollments = await db.programEnrollment.findMany({
    where: { userId: session.user.id, status: { in: ["ENROLLED", "COMPLETED", "GRADUATED"] } },
    include: { program: { include: { feeStructures: true } } },
  });
  let totalFees = 0;
  const feeStructureIds = new Set<string>();
  for (const e of enrollments) {
    for (const fs of e.program.feeStructures) {
      if (!feeStructureIds.has(fs.id)) {
        feeStructureIds.add(fs.id);
        totalFees += fs.totalAmount;
      }
    }
  }
  // Fallback: include profile.program fee structures if not already counted
  if (profile.program?.feeStructures) {
    for (const fs of profile.program.feeStructures) {
      if (!feeStructureIds.has(fs.id)) {
        feeStructureIds.add(fs.id);
        totalFees += fs.totalAmount;
      }
    }
  }
  const totalPaid = profile.feePayments.reduce((sum, fp) => sum + fp.amountPaid, 0);
  const pendingAmount = totalFees - totalPaid;

  const receipts = await Promise.all(
    profile.feePayments
      .filter((fp) => fp.receiptUrl)
      .map(async (fp) => {
        const versions = await db.studentSubmissionLog.findMany({
          where: {
            feePaymentId: fp.id,
            kind: StudentSubmissionKind.FEE_RECEIPT,
          },
          orderBy: { createdAt: "desc" },
        });
        const trail =
          versions.length > 0
            ? versions.map((v) => ({
                fileUrl: v.fileUrl,
                fileName: v.fileName,
                uploadedAt: v.createdAt.toISOString(),
              }))
            : [
                {
                  fileUrl: fp.receiptUrl!,
                  fileName: fp.receiptFileName ?? "receipt",
                  uploadedAt: fp.createdAt.toISOString(),
                },
              ];

        return {
          id: fp.id,
          fileName: fp.receiptFileName ?? "receipt",
          fileUrl: fp.receiptUrl!,
          amountPaid: fp.amountPaid,
          paymentDate: fp.paymentDate.toISOString(),
          confirmed: !!fp.confirmedAt,
          trail,
        };
      }),
  );

  const pendingDocCount = documents?.filter((d) => !d.completed).length ?? 0;
  const highPriorityCount =
    pendingAssessments.length +
    pendingDocCount +
    belowPassingResults.length +
    attendanceAlerts.length;

  return NextResponse.json({
    pendingAssessments,
    belowPassingResults,
    attendanceAlerts,
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
      belowPassing: belowPassingResults.length,
      attendance: attendanceAlerts.length,
      highPriority: highPriorityCount,
      total: pendingAssessments.length + pendingDocCount + (pendingAmount > 0 ? 1 : 0) + belowPassingResults.length + attendanceAlerts.length,
    },
  });
}
