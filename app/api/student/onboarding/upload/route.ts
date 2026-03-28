import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { ONBOARDING_ALLOWED_EXT, ONBOARDING_MAX_BYTES, writePublicUpload } from "@/lib/file-upload";
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

  const buf = Buffer.from(await file.arrayBuffer());
  const subdir = `onboarding/${session.user.id}`;
  const result = await writePublicUpload({
    buffer: buf,
    originalName: file.name || "document.bin",
    allowedExt: ONBOARDING_ALLOWED_EXT,
    maxBytes: ONBOARDING_MAX_BYTES,
    publicSubdir: subdir,
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

  const updated = await db.studentOnboarding.findUnique({ where: { userId: session.user.id } });

  const allDone =
    updated &&
    updated.contractAcknowledgedAt &&
    updated.governmentIdsUploadedAt &&
    updated.feeProofUploadedAt &&
    updated.preAdmissionCompletedAt;

  if (allDone) {
    const student = await db.user.findUnique({
      where: { id: session.user.id },
      select: { firstName: true, lastName: true },
    });
    const name = student ? `${student.firstName} ${student.lastName}` : "A student";
    const principals = await db.user.findMany({ where: { role: "PRINCIPAL" }, select: { id: true } });
    if (principals.length > 0) {
      await db.notification.createMany({
        data: principals.map((p) => ({
          userId: p.id,
          type: "ONBOARDING_STUDENT_COMPLETED" as const,
          title: "Onboarding checklist complete",
          message: `${name} completed all onboarding steps. Confirm in Students when ready.`,
          link: "/principal/students",
        })),
      });
    }
  }

  return NextResponse.json({
    success: true,
    uploaded: true,
    message: "File uploaded successfully.",
    onboarding: updated,
  });
}
