import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { ONBOARDING_ALLOWED_EXT, ONBOARDING_MAX_BYTES, uploadToBlob } from "@/lib/file-upload";
import { notifyPrincipalsIfOnboardingChecklistJustCompleted } from "@/lib/notify-principals-onboarding-complete";
import { StudentSubmissionKind } from "@/app/generated/prisma/client";
import { NextResponse } from "next/server";

export const runtime = "nodejs";

type Step = "contract" | "ids" | "fee";

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  let formData: FormData;
  try {
    formData = await req.formData();
  } catch {
    return NextResponse.json({ error: "Invalid form data." }, { status: 400 });
  }

  const file = formData.get("file") as File | null;
  const step = formData.get("step") as Step | null;

  if (!file || !step) {
    return NextResponse.json({ error: "Missing file or step (contract, ids, or fee)." }, { status: 400 });
  }

  if (step !== "contract" && step !== "ids" && step !== "fee") {
    return NextResponse.json({ error: "Invalid step." }, { status: 400 });
  }

  const existing = await db.studentOnboarding.findUnique({ where: { userId: session.user.id } });
  if (!existing) {
    return NextResponse.json({ error: "No onboarding record. Complete enrollment first." }, { status: 400 });
  }

  const wasCompleteBefore =
    !!existing.contractAcknowledgedAt &&
    !!existing.governmentIdsUploadedAt &&
    !!existing.feeProofUploadedAt &&
    !!existing.preAdmissionCompletedAt;

  const buf = Buffer.from(await file.arrayBuffer());
  const result = await uploadToBlob({
    buffer: buf,
    originalName: file.name || "document.bin",
    allowedExt: ONBOARDING_ALLOWED_EXT,
    maxBytes: ONBOARDING_MAX_BYTES,
    folder: `onboarding/${session.user.id}`,
  });

  if ("error" in result) {
    return NextResponse.json({ error: result.error, uploaded: false }, { status: 400 });
  }

  const now = new Date();
  const data =
    step === "contract"
      ? {
          signedContractUploadUrl: result.url,
          signedContractFileName: result.storedFileName,
          contractAcknowledgedAt: now,
        }
      : step === "ids"
        ? {
            governmentIdUploadUrl: result.url,
            governmentIdFileName: result.storedFileName,
            governmentIdsUploadedAt: now,
          }
        : {
            feeProofUploadUrl: result.url,
            feeProofFileName: result.storedFileName,
            feeProofUploadedAt: now,
          };

  await db.studentOnboarding.update({
    where: { userId: session.user.id },
    data,
  });

  const profile = await db.studentProfile.findUnique({
    where: { userId: session.user.id },
    select: { id: true },
  });
  if (profile) {
    const kind =
      step === "contract"
        ? StudentSubmissionKind.SIGNED_CONTRACT
        : step === "ids"
          ? StudentSubmissionKind.GOVERNMENT_ID
          : StudentSubmissionKind.ONBOARDING_FEE_PROOF;
    await db.studentSubmissionLog.create({
      data: {
        studentProfileId: profile.id,
        kind,
        fileUrl: result.url,
        fileName: result.storedFileName,
      },
    });
  }

  const updated = await db.studentOnboarding.findUnique({ where: { userId: session.user.id } });

  await notifyPrincipalsIfOnboardingChecklistJustCompleted(session.user.id, wasCompleteBefore);

  return NextResponse.json({
    success: true,
    uploaded: true,
    message: "File uploaded successfully.",
    onboarding: updated,
  });
}
