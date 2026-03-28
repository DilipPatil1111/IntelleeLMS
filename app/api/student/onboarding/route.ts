import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { NextResponse } from "next/server";

export const runtime = "nodejs";

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

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
  });
}

export async function PATCH(req: Request) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  const step = body.step as string | undefined;

  /** Steps 1–3 require file upload via POST /api/student/onboarding/upload */
  if (step !== "preAdmission") {
    return NextResponse.json(
      {
        error:
          "Use file upload for agreement, ID, and fee proof. Only the pre-admission step can be marked complete here.",
      },
      { status: 400 }
    );
  }

  const existing = await db.studentOnboarding.findUnique({ where: { userId: session.user.id } });
  if (!existing) {
    return NextResponse.json({ error: "No onboarding record. Complete enrollment first." }, { status: 400 });
  }

  await db.studentOnboarding.update({
    where: { userId: session.user.id },
    data: { preAdmissionCompletedAt: new Date() },
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

  return NextResponse.json({ success: true, onboarding: updated });
}
