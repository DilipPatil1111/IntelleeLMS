import { NextResponse } from "next/server";
import { requireStudentPortal } from "@/lib/api-auth";
import { db } from "@/lib/db";
import { StudentSubmissionKind } from "@/app/generated/prisma/client";
import { isProgramContentCompleteForStudent } from "@/lib/program-content";

export async function GET() {
  const gate = await requireStudentPortal();
  if (!gate.ok) return gate.response;
  const session = gate.session;

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
          batch: true,
        },
      },
    },
  });

  if (!user?.studentProfile) {
    return NextResponse.json({
      programs: [],
      pendingAssessments: [],
      belowPassingResults: [],
      attendanceAlerts: [],
      documents: null,
      fees: { totalFees: 0, totalPaid: 0, pendingAmount: 0, receipts: [] },
      counts: { assessments: 0, documents: 0, fees: 0, belowPassing: 0, attendance: 0, highPriority: 0, total: 0 },
    });
  }

  const profile = user.studentProfile;

  // ── Collect all programs the student is enrolled in ────────────────────────
  const enrollments = await db.programEnrollment.findMany({
    where: { userId: session.user.id, status: { in: ["ENROLLED", "COMPLETED", "GRADUATED"] } },
    include: {
      program: { include: { feeStructures: true, subjects: { select: { id: true, name: true } } } },
      batch: { select: { id: true } },
    },
  });

  type ProgramInfo = { id: string; name: string; subjectIds: string[]; batchId: string | null };
  const programMap = new Map<string, ProgramInfo>();

  // Collect ALL batch IDs the student is associated with
  const allBatchIds = new Set<string>();
  if (profile.batchId) allBatchIds.add(profile.batchId);

  for (const e of enrollments) {
    if (e.batchId) allBatchIds.add(e.batchId);
    if (e.batch?.id) allBatchIds.add(e.batch.id);
    if (!programMap.has(e.programId)) {
      programMap.set(e.programId, {
        id: e.programId,
        name: e.program.name,
        subjectIds: e.program.subjects.map((s) => s.id),
        batchId: e.batchId ?? e.batch?.id ?? null,
      });
    }
  }

  // Also include legacy studentProfile.program
  if (profile.programId && !programMap.has(profile.programId)) {
    const prog = await db.program.findUnique({
      where: { id: profile.programId },
      include: { subjects: { select: { id: true, name: true } } },
    });
    if (prog) {
      programMap.set(prog.id, {
        id: prog.id,
        name: prog.name,
        subjectIds: prog.subjects.map((s) => s.id),
        batchId: profile.batchId,
      });
    }
  }

  // ── Pending Assessments & Below-Passing Results ────────────────────────────
  type PendingAssessmentItem = {
    id: string;
    title: string;
    subjectName: string;
    programId: string;
    type: string;
    scheduledCloseAt: string | null;
    status: "NOT_STARTED" | "IN_PROGRESS";
    priority: "HIGH" | "NORMAL";
  };
  type BelowPassingItem = {
    id: string;
    title: string;
    subjectName: string;
    programId: string;
    type: string;
    score: number;
    totalMarks: number;
    passingMarks: number;
    priority: "HIGH";
    message: string;
    retakeRequest: {
      id: string;
      status: string;
      staffMessage: string | null;
      resolvedByName: string | null;
    } | null;
  };

  let pendingAssessments: PendingAssessmentItem[] = [];
  let belowPassingResults: BelowPassingItem[] = [];

  const batchIdArray = [...allBatchIds];

  if (batchIdArray.length > 0) {
    try {
      // Query assessments across ALL enrolled batches (PUBLISHED + CLOSED + GRADED for history)
      const assessments = await db.assessment.findMany({
        where: {
          status: { in: ["PUBLISHED", "CLOSED", "GRADED"] },
          batchId: { in: batchIdArray },
          OR: [
            { assignedStudents: { none: {} } },
            { assignedStudents: { some: { studentId: user.id } } },
          ],
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
          programId: a.subject?.programId ?? "",
          type: a.type,
          scheduledCloseAt: a.scheduledCloseAt?.toISOString() ?? null,
          status: a.attempts[0]?.status === "IN_PROGRESS" ? ("IN_PROGRESS" as const) : ("NOT_STARTED" as const),
          priority: "HIGH" as const,
        }));

      // Fetch retake requests for this student (safe if table doesn't exist yet)
      type RRRow = { id: string; assessmentId: string; status: string; staffMessage: string | null; resolvedBy: { firstName: string; lastName: string } | null };
      let retakeMap = new Map<string, RRRow>();
      try {
        const retakeRequests = await db.assessmentRetakeRequest.findMany({
          where: { studentUserId: user.id },
          include: { resolvedBy: { select: { firstName: true, lastName: true } } },
        });
        retakeMap = new Map(retakeRequests.map((r) => [r.assessmentId, r as RRRow]));
      } catch {
        // Table may not exist yet before migration runs
      }

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
          const rr = retakeMap.get(a.id);
          return {
            id: a.id,
            title: a.title,
            subjectName: a.subject?.name ?? "",
            programId: a.subject?.programId ?? "",
            type: a.type,
            score: attempt.totalScore ?? 0,
            totalMarks,
            passingMarks,
            priority: "HIGH" as const,
            message: rr?.status === "EXCUSED"
              ? `Excused for certificate — ${rr.staffMessage || "No additional comments."}`
              : rr?.status === "APPROVED_RETAKE"
                ? "Retake approved — you can now retake this assessment."
                : rr?.status === "DENIED"
                  ? `Retake denied — ${rr.staffMessage || "Please contact your teacher."}`
                  : "Please contact Principal/Administrator for further action.",
            retakeRequest: rr
              ? {
                  id: rr.id,
                  status: rr.status,
                  staffMessage: rr.staffMessage,
                  resolvedByName: rr.resolvedBy
                    ? `${rr.resolvedBy.firstName} ${rr.resolvedBy.lastName}`
                    : null,
                }
              : null,
          };
        });
    } catch (err) {
      console.error("[pending-actions] assessment query fallback:", err);
    }
  }

  // ── Attendance Alerts (by subject → program) ──────────────────────────────
  type AttendanceAlertItem = {
    subjectName: string;
    programId: string;
    attendancePercent: number;
    requiredPercent: number;
    priority: "HIGH";
    message: string;
  };
  type AbsentRecordItem = {
    id: string;
    sessionDate: string;
    subjectName: string;
    programId: string;
    excuseRequest: {
      id: string;
      status: string;
      staffMessage: string | null;
      resolvedByName: string | null;
    } | null;
  };
  const attendanceAlerts: AttendanceAlertItem[] = [];
  let absentRecords: AbsentRecordItem[] = [];

  if (batchIdArray.length > 0) {
    try {
      const attendanceRecords = await db.attendanceRecord.findMany({
        where: { studentId: user.id },
        include: { session: { include: { subject: true } } },
      });

      // Fetch excuse requests for this student
      type ERRow = {
        id: string;
        attendanceRecordId: string;
        status: string;
        staffMessage: string | null;
        resolvedBy: { firstName: string; lastName: string } | null;
      };
      let excuseMap = new Map<string, ERRow>();
      try {
        const excuseRequests = await db.attendanceExcuseRequest.findMany({
          where: { studentUserId: user.id },
          include: { resolvedBy: { select: { firstName: true, lastName: true } } },
        });
        excuseMap = new Map(excuseRequests.map((r) => [r.attendanceRecordId, r as ERRow]));
      } catch {
        // Table may not exist yet
      }

      const bySubject = new Map<string, { present: number; total: number; name: string; programId: string }>();
      for (const r of attendanceRecords) {
        const subName = r.session?.subject?.name ?? "Unknown";
        const subId = r.session?.subjectId ?? "unknown";
        const progId = r.session?.subject?.programId ?? "";
        const entry = bySubject.get(subId) ?? { present: 0, total: 0, name: subName, programId: progId };
        entry.total++;
        if (r.status === "PRESENT" || r.status === "LATE" || r.status === "EXCUSED") entry.present++;
        bySubject.set(subId, entry);
      }

      const REQUIRED_PERCENT = 75;
      for (const [, data] of bySubject) {
        if (data.total === 0) continue;
        const pct = Math.round((data.present / data.total) * 100);
        if (pct < REQUIRED_PERCENT) {
          attendanceAlerts.push({
            subjectName: data.name,
            programId: data.programId,
            attendancePercent: pct,
            requiredPercent: REQUIRED_PERCENT,
            priority: "HIGH",
            message: "Please contact Principal/Administrator for further action.",
          });
        }
      }

      // Build absent records with excuse request info (only show unresolved or with pending excuse)
      absentRecords = attendanceRecords
        .filter((r) => r.status === "ABSENT")
        .map((r) => {
          const er = excuseMap.get(r.id);
          return {
            id: r.id,
            sessionDate: r.session?.sessionDate
              ? new Date(r.session.sessionDate).toISOString()
              : new Date().toISOString(),
            subjectName: r.session?.subject?.name ?? "Unknown",
            programId: r.session?.subject?.programId ?? "",
            excuseRequest: er
              ? {
                  id: er.id,
                  status: er.status,
                  staffMessage: er.staffMessage,
                  resolvedByName: er.resolvedBy
                    ? `${er.resolvedBy.firstName} ${er.resolvedBy.lastName}`
                    : null,
                }
              : null,
          };
        })
        // Hide resolved (EXCUSED/DENIED/KEPT_ABSENT) from pending view
        .filter((r) => !r.excuseRequest || r.excuseRequest.status === "PENDING");
    } catch (err) {
      console.error("[pending-actions] attendance alert fallback:", err);
    }
  }

  // ── Build program-wise summary ─────────────────────────────────────────────
  type ProgramSummary = {
    programId: string;
    programName: string;
    pendingAssessments: PendingAssessmentItem[];
    belowPassingResults: BelowPassingItem[];
    attendanceAlerts: AttendanceAlertItem[];
    absentRecords: AbsentRecordItem[];
    pendingCount: number;
    eligible: boolean;
  };

  const programSummaries: ProgramSummary[] = [];

  for (const [progId, info] of programMap) {
    const pa = pendingAssessments.filter((a) => a.programId === progId);
    const bp = belowPassingResults.filter((a) => a.programId === progId);
    const aa = attendanceAlerts.filter((a) => a.programId === progId);
    const ar = absentRecords.filter((a) => a.programId === progId);
    const pendingCount = pa.length + bp.length + aa.length;

    let eligible = false;
    if (pendingCount === 0) {
      try {
        eligible = await isProgramContentCompleteForStudent(session.user.id, progId);
      } catch {
        eligible = false;
      }
    }

    programSummaries.push({
      programId: progId,
      programName: info.name,
      pendingAssessments: pa,
      belowPassingResults: bp,
      attendanceAlerts: aa,
      absentRecords: ar,
      pendingCount,
      eligible,
    });
  }

  // ── Documents (not program-specific) ───────────────────────────────────────
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
              return [{
                fileUrl: onboarding.signedContractUploadUrl,
                fileName: onboarding.signedContractFileName ?? "document",
                uploadedAt: onboarding.contractAcknowledgedAt?.toISOString() ?? new Date().toISOString(),
              }];
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
              return [{
                fileUrl: onboarding.governmentIdUploadUrl,
                fileName: onboarding.governmentIdFileName ?? "document",
                uploadedAt: onboarding.governmentIdsUploadedAt?.toISOString() ?? new Date().toISOString(),
              }];
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
              return [{
                fileUrl: onboarding.feeProofUploadUrl,
                fileName: onboarding.feeProofFileName ?? "document",
                uploadedAt: onboarding.feeProofUploadedAt?.toISOString() ?? new Date().toISOString(),
              }];
            }
            return [];
          })(),
        },
      ]
    : null;

  // ── Fees (multi-program) ───────────────────────────────────────────────────
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
          where: { feePaymentId: fp.id, kind: StudentSubmissionKind.FEE_RECEIPT },
          orderBy: { createdAt: "desc" },
        });
        const trail =
          versions.length > 0
            ? versions.map((v) => ({ fileUrl: v.fileUrl, fileName: v.fileName, uploadedAt: v.createdAt.toISOString() }))
            : [{ fileUrl: fp.receiptUrl!, fileName: fp.receiptFileName ?? "receipt", uploadedAt: fp.createdAt.toISOString() }];
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
    pendingAssessments.length + pendingDocCount + belowPassingResults.length + attendanceAlerts.length;

  return NextResponse.json({
    programs: programSummaries,
    pendingAssessments,
    belowPassingResults,
    attendanceAlerts,
    absentRecords,
    documents,
    fees: { totalFees, totalPaid, pendingAmount, receipts },
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
