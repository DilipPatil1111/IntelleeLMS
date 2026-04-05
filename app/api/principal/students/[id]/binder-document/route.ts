import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { StudentSubmissionKind } from "@/app/generated/prisma/client";
import {
  ONBOARDING_ALLOWED_EXT,
  ONBOARDING_MAX_BYTES,
  uploadToBlob,
} from "@/lib/file-upload";
import { blobDel, blobPut } from "@/lib/vercel-blob";
import { randomUUID } from "crypto";
import path from "path";

function isPrincipal(session: { user?: { role?: string } } | null) {
  return session?.user?.role === "PRINCIPAL";
}

/** Principal replaces or clears student-linked binder sources (onboarding docs + fee receipts). */
export async function PUT(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id: userId } = await params;
  const session = await auth();
  if (!isPrincipal(session)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const url = new URL(req.url);
  const kind = url.searchParams.get("kind");
  const feePaymentId = url.searchParams.get("feePaymentId");

  if (
    kind !== "contract" &&
    kind !== "ids" &&
    kind !== "fee" &&
    kind !== "fee_receipt"
  ) {
    return NextResponse.json(
      { error: "Invalid kind. Use contract, ids, fee, or fee_receipt." },
      { status: 400 },
    );
  }

  if (kind === "fee_receipt" && !feePaymentId) {
    return NextResponse.json(
      { error: "feePaymentId is required for fee_receipt." },
      { status: 400 },
    );
  }

  const formData = await req.formData();
  const file = formData.get("file") as File | null;
  if (!file) {
    return NextResponse.json({ error: "No file provided" }, { status: 400 });
  }

  const profile = await db.studentProfile.findUnique({
    where: { userId },
    select: { id: true },
  });
  if (!profile) {
    return NextResponse.json({ error: "Student not found" }, { status: 404 });
  }

  if (kind === "fee_receipt") {
    const payment = await db.feePayment.findFirst({
      where: { id: feePaymentId!, studentProfileId: profile.id },
    });
    if (!payment) {
      return NextResponse.json({ error: "Fee payment not found" }, { status: 404 });
    }

    if (payment.receiptUrl) {
      await db.studentSubmissionLog.create({
        data: {
          studentProfileId: profile.id,
          kind: StudentSubmissionKind.FEE_RECEIPT,
          feePaymentId: payment.id,
          fileUrl: payment.receiptUrl,
          fileName: payment.receiptFileName ?? "receipt",
          amountPaid: payment.amountPaid,
        },
      });
      try {
        await blobDel(payment.receiptUrl);
      } catch {
        /* ignore */
      }
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    const ext = path.extname(file.name).toLowerCase() || ".bin";
    const safeName = `${Date.now()}-${randomUUID().slice(0, 8)}${ext}`;
    const pathname = `fee-receipts/${userId}/${safeName}`;

    const blob = await blobPut(pathname, buffer, {
      access: "public",
      contentType: file.type || "application/octet-stream",
    });

    const updated = await db.feePayment.update({
      where: { id: payment.id },
      data: {
        receiptUrl: blob.url,
        receiptFileName: file.name,
      },
    });

    await db.studentSubmissionLog.create({
      data: {
        studentProfileId: profile.id,
        kind: StudentSubmissionKind.FEE_RECEIPT,
        feePaymentId: payment.id,
        fileUrl: blob.url,
        fileName: file.name,
        amountPaid: payment.amountPaid,
      },
    });

    return NextResponse.json({
      ok: true,
      payment: {
        id: updated.id,
        receiptUrl: updated.receiptUrl,
        receiptFileName: updated.receiptFileName,
      },
    });
  }

  const buf = Buffer.from(await file.arrayBuffer());
  const result = await uploadToBlob({
    buffer: buf,
    originalName: file.name || "document.bin",
    allowedExt: ONBOARDING_ALLOWED_EXT,
    maxBytes: ONBOARDING_MAX_BYTES,
    folder: `onboarding/${userId}`,
  });

  if ("error" in result) {
    return NextResponse.json({ error: result.error }, { status: 400 });
  }

  const onboarding = await db.studentOnboarding.findUnique({
    where: { userId },
  });
  if (!onboarding) {
    return NextResponse.json(
      { error: "No onboarding record for this student." },
      { status: 400 },
    );
  }

  const logKind =
    kind === "contract"
      ? StudentSubmissionKind.SIGNED_CONTRACT
      : kind === "ids"
        ? StudentSubmissionKind.GOVERNMENT_ID
        : StudentSubmissionKind.ONBOARDING_FEE_PROOF;

  const oldUrl =
    kind === "contract"
      ? onboarding.signedContractUploadUrl
      : kind === "ids"
        ? onboarding.governmentIdUploadUrl
        : onboarding.feeProofUploadUrl;

  if (oldUrl) {
    try {
      await blobDel(oldUrl);
    } catch {
      /* ignore */
    }
  }

  const now = new Date();
  const data =
    kind === "contract"
      ? {
          signedContractUploadUrl: result.url,
          signedContractFileName: result.storedFileName,
          contractAcknowledgedAt: now,
        }
      : kind === "ids"
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
    where: { userId },
    data,
  });

  await db.studentSubmissionLog.create({
    data: {
      studentProfileId: profile.id,
      kind: logKind,
      fileUrl: result.url,
      fileName: result.storedFileName,
    },
  });

  const updated = await db.studentOnboarding.findUnique({
    where: { userId },
  });

  return NextResponse.json({ ok: true, onboarding: updated });
}

export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id: userId } = await params;
  const session = await auth();
  if (!isPrincipal(session)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const url = new URL(req.url);
  const kind = url.searchParams.get("kind");
  const feePaymentId = url.searchParams.get("feePaymentId");

  if (
    kind !== "contract" &&
    kind !== "ids" &&
    kind !== "fee" &&
    kind !== "fee_receipt"
  ) {
    return NextResponse.json(
      { error: "Invalid kind. Use contract, ids, fee, or fee_receipt." },
      { status: 400 },
    );
  }

  if (kind === "fee_receipt" && !feePaymentId) {
    return NextResponse.json(
      { error: "feePaymentId is required for fee_receipt." },
      { status: 400 },
    );
  }

  const profile = await db.studentProfile.findUnique({
    where: { userId },
    select: { id: true },
  });
  if (!profile) {
    return NextResponse.json({ error: "Student not found" }, { status: 404 });
  }

  if (kind === "fee_receipt") {
    const payment = await db.feePayment.findFirst({
      where: { id: feePaymentId!, studentProfileId: profile.id },
    });
    if (!payment) {
      return NextResponse.json({ error: "Fee payment not found" }, { status: 404 });
    }
    if (payment.receiptUrl) {
      try {
        await blobDel(payment.receiptUrl);
      } catch {
        /* ignore */
      }
    }
    await db.feePayment.update({
      where: { id: payment.id },
      data: { receiptUrl: null, receiptFileName: null },
    });
    return NextResponse.json({ ok: true });
  }

  const onboarding = await db.studentOnboarding.findUnique({
    where: { userId },
  });
  if (!onboarding) {
    return NextResponse.json(
      { error: "No onboarding record for this student." },
      { status: 400 },
    );
  }

  const oldUrl =
    kind === "contract"
      ? onboarding.signedContractUploadUrl
      : kind === "ids"
        ? onboarding.governmentIdUploadUrl
        : onboarding.feeProofUploadUrl;

  if (oldUrl) {
    try {
      await blobDel(oldUrl);
    } catch {
      /* ignore */
    }
  }

  const data =
    kind === "contract"
      ? {
          signedContractUploadUrl: null,
          signedContractFileName: null,
          contractAcknowledgedAt: null,
        }
      : kind === "ids"
        ? {
            governmentIdUploadUrl: null,
            governmentIdFileName: null,
            governmentIdsUploadedAt: null,
          }
        : {
            feeProofUploadUrl: null,
            feeProofFileName: null,
            feeProofUploadedAt: null,
          };

  await db.studentOnboarding.update({
    where: { userId },
    data,
  });

  return NextResponse.json({ ok: true });
}
