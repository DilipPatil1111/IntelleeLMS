import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { hasPrincipalPortalAccess } from "@/lib/portal-access";
import { NextResponse } from "next/server";

export const runtime = "nodejs";

export async function GET(req: Request) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!hasPrincipalPortalAccess(session)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { searchParams } = new URL(req.url);
  const programId = searchParams.get("programId") || undefined;
  const batchId = searchParams.get("batchId") || undefined;

  // Build where clause for StudentProfile
  const where: Record<string, unknown> = {};
  if (programId) where.programId = programId;
  if (batchId) where.batchId = batchId;

  // Students from StudentProfile (legacy single-program)
  const profileStudents = await db.studentProfile.findMany({
    where,
    include: {
      user: { select: { id: true, firstName: true, lastName: true, email: true } },
      program: { include: { feeStructures: { select: { id: true, name: true, totalAmount: true } } } },
      batch: { select: { id: true, name: true } },
      feePayments: {
        include: {
          feeStructure: { select: { id: true, name: true, programId: true, totalAmount: true, program: { select: { id: true, name: true } } } },
        },
      },
    },
  });

  // Also get students enrolled via ProgramEnrollment if programId filter is set
  let enrollmentStudentIds: string[] = [];
  if (programId) {
    const enrollments = await db.programEnrollment.findMany({
      where: {
        programId,
        status: { in: ["ENROLLED", "COMPLETED", "GRADUATED"] },
      },
      select: { userId: true },
    });
    enrollmentStudentIds = enrollments.map((e) => e.userId);

    // Find StudentProfiles for enrolled students not already in profileStudents
    const existingUserIds = new Set(profileStudents.map((s) => s.userId));
    const additionalIds = enrollmentStudentIds.filter((id) => !existingUserIds.has(id));

    if (additionalIds.length > 0) {
      const additionalProfiles = await db.studentProfile.findMany({
        where: {
          userId: { in: additionalIds },
          ...(batchId ? { batchId } : {}),
        },
        include: {
          user: { select: { id: true, firstName: true, lastName: true, email: true } },
          program: { include: { feeStructures: { select: { id: true, name: true, totalAmount: true } } } },
          batch: { select: { id: true, name: true } },
          feePayments: {
            include: {
              feeStructure: { select: { id: true, name: true, programId: true, totalAmount: true, program: { select: { id: true, name: true } } } },
            },
          },
        },
      });
      profileStudents.push(...additionalProfiles);
    }
  }

  // Fetch the program's fee structures for the filter if we need to compute for enrolled students
  let filterProgramFeeTotal = 0;
  if (programId) {
    const prog = await db.program.findUnique({
      where: { id: programId },
      include: { feeStructures: { select: { totalAmount: true } } },
    });
    filterProgramFeeTotal = prog?.feeStructures.reduce((s, fs) => s + fs.totalAmount, 0) ?? 0;
  }

  const onboardingRecords = await db.studentOnboarding.findMany({
    where: {
      userId: { in: profileStudents.map((s) => s.userId) },
    },
    select: {
      userId: true,
      feeProofUploadUrl: true,
      feeProofFileName: true,
    },
  });
  const onboardingByUserId = new Map(onboardingRecords.map((o) => [o.userId, o]));

  const result = profileStudents.map((sp) => {
    // When a specific program filter is active, show that program's fees
    // Otherwise show the fees from the student's primary program
    let totalFees: number;
    if (programId) {
      totalFees = filterProgramFeeTotal;
    } else {
      totalFees = sp.program?.feeStructures.reduce((sum, fs) => sum + fs.totalAmount, 0) ?? 0;
    }

    // Payments related to the filtered program, or all payments if no filter
    const relevantPayments = programId
      ? sp.feePayments.filter((fp) => fp.feeStructure.programId === programId)
      : sp.feePayments;

    const totalPaid = relevantPayments.reduce((sum, fp) => sum + fp.amountPaid, 0);
    const pendingAmount = totalFees - totalPaid;
    const onboarding = onboardingByUserId.get(sp.userId);

    const receipts = relevantPayments
      .filter((fp) => fp.receiptUrl)
      .map((fp) => ({
        id: fp.id,
        fileName: fp.receiptFileName,
        fileUrl: fp.receiptUrl,
        amountPaid: fp.amountPaid,
        confirmed: !!fp.confirmedAt,
        programName: fp.feeStructure.program?.name ?? null,
      }));

    if (onboarding?.feeProofUploadUrl) {
      receipts.unshift({
        id: `onboarding-${sp.userId}`,
        fileName: onboarding.feeProofFileName ?? "Fee proof (onboarding)",
        fileUrl: onboarding.feeProofUploadUrl,
        amountPaid: 0,
        confirmed: false,
        programName: "",
      });
    }

    return {
      studentId: sp.id,
      userId: sp.userId,
      name: `${sp.user.firstName} ${sp.user.lastName}`,
      email: sp.user.email,
      programName: sp.program?.name ?? null,
      batchName: sp.batch?.name ?? null,
      total: totalFees,
      paid: totalPaid,
      pending: pendingAmount,
      receipts: receipts.map((r) => ({
        id: r.id,
        fileName: r.fileName ?? "receipt",
        amount: r.amountPaid,
        date: new Date().toISOString(),
        receiptUrl: r.fileUrl ?? "",
        confirmed: r.confirmed,
        programName: r.programName,
      })),
    };
  });

  return NextResponse.json({ students: result });
}
