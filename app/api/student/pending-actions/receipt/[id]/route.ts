import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { StudentSubmissionKind } from "@/app/generated/prisma/client";
import { blobPut } from "@/lib/vercel-blob";
import { randomUUID } from "crypto";
import path from "path";

/** Replace the receipt file on an existing fee payment (student-owned). Appends to submission trail. */
export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id: feePaymentId } = await params;
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const payment = await db.feePayment.findFirst({
    where: {
      id: feePaymentId,
      studentProfile: { userId: session.user.id },
    },
  });

  if (!payment) {
    return NextResponse.json({ error: "Payment not found" }, { status: 404 });
  }

  const formData = await req.formData();
  const file = formData.get("file") as File | null;
  if (!file) return NextResponse.json({ error: "No file provided" }, { status: 400 });

  if (payment.receiptUrl) {
    await db.studentSubmissionLog.create({
      data: {
        studentProfileId: payment.studentProfileId,
        kind: StudentSubmissionKind.FEE_RECEIPT,
        feePaymentId: payment.id,
        fileUrl: payment.receiptUrl,
        fileName: payment.receiptFileName ?? "receipt",
        amountPaid: payment.amountPaid,
      },
    });
  }

  const buffer = Buffer.from(await file.arrayBuffer());
  const ext = path.extname(file.name).toLowerCase() || ".bin";
  const safeName = `${Date.now()}-${randomUUID().slice(0, 8)}${ext}`;
  const pathname = `fee-receipts/${session.user.id}/${safeName}`;

  const blob = await blobPut(pathname, buffer, {
    access: "public",
    contentType: file.type || "application/octet-stream",
  });

  const updated = await db.feePayment.update({
    where: { id: feePaymentId },
    data: {
      receiptUrl: blob.url,
      receiptFileName: file.name,
    },
  });

  await db.studentSubmissionLog.create({
    data: {
      studentProfileId: payment.studentProfileId,
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
