import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { notifyPrincipalsIfOnboardingChecklistJustCompleted } from "@/lib/notify-principals-onboarding-complete";
import { NextResponse } from "next/server";

export const runtime = "nodejs";

function shouldEnsureOnboardingRow(status: string | undefined): boolean {
  return status === "ENROLLED" || status === "GRADUATED" || status === "COMPLETED";
}

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const user = await db.user.findUnique({
    where: { id: session.user.id },
    select: { role: true, studentProfile: { select: { id: true, status: true } } },
  });

  /** Legacy / edge: ensure row only for fully enrolled statuses (not APPLIED / bare ACCEPTED). */
  if (user?.role === "STUDENT" && user.studentProfile && shouldEnsureOnboardingRow(user.studentProfile.status)) {
    await db.studentOnboarding.upsert({
      where: { userId: session.user.id },
      create: { userId: session.user.id },
      update: {},
    });
  }

  const [onboarding, institution] = await Promise.all([
    db.studentOnboarding.findUnique({
      where: { userId: session.user.id },
    }),
    db.institutionSettings.findUnique({ where: { id: 1 } }),
  ]);

  const sampleContractUrl =
    institution?.studentContractSampleUrl?.trim() ||
    onboarding?.contractDocumentUrl?.trim() ||
    null;

  const sampleContractFileName =
    institution?.studentContractSampleFileName ||
    (sampleContractUrl && onboarding?.contractDocumentUrl ? "Sample agreement" : null);

  return NextResponse.json({
    onboarding,
    sampleContractUrl,
    sampleContractFileName,
    studentProfileStatus: user?.studentProfile?.status ?? null,
  });
}

const MARKABLE_STEPS = new Set(["contract", "governmentIds", "feeProof", "preAdmission"]);

export async function PATCH(req: Request) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  const step = body.step as string | undefined;

  if (!step || !MARKABLE_STEPS.has(step)) {
    return NextResponse.json(
      {
        error: "Invalid step. Use contract, governmentIds, feeProof, or preAdmission.",
      },
      { status: 400 }
    );
  }

  const existing = await db.studentOnboarding.findUnique({ where: { userId: session.user.id } });
  if (!existing) {
    return NextResponse.json({ error: "No onboarding record. Your placement must be confirmed first." }, { status: 400 });
  }

  const wasCompleteBefore =
    !!existing.contractAcknowledgedAt &&
    !!existing.governmentIdsUploadedAt &&
    !!existing.feeProofUploadedAt &&
    !!existing.preAdmissionCompletedAt;

  const now = new Date();
  const data =
    step === "contract"
      ? { contractAcknowledgedAt: now }
      : step === "governmentIds"
        ? { governmentIdsUploadedAt: now }
        : step === "feeProof"
          ? { feeProofUploadedAt: now }
          : { preAdmissionCompletedAt: now };

  await db.studentOnboarding.update({
    where: { userId: session.user.id },
    data,
  });

  const updated = await db.studentOnboarding.findUnique({ where: { userId: session.user.id } });

  await notifyPrincipalsIfOnboardingChecklistJustCompleted(session.user.id, wasCompleteBefore);

  return NextResponse.json({ success: true, onboarding: updated });
}
