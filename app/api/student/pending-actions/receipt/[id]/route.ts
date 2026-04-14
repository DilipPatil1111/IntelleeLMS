import { NextRequest, NextResponse } from "next/server";
import { requireStudentPortal } from "@/lib/api-auth";
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
  const gate = await requireStudentPortal();
  if (!gate.ok) return gate.response;
  const session = gate.session;

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

  // Notify principals about updated fee receipt
  const student = await db.user.findUnique({
    where: { id: session.user.id },
    select: { firstName: true, lastName: true },
  });
  const studentName = student ? `${student.firstName} ${student.lastName}` : "A student";
  const principals = await db.user.findMany({
    where: { role: "PRINCIPAL", isActive: true },
    select: { id: true },
  });
  if (principals.length > 0) {
    await db.notification.createMany({
      data: principals.map((p) => ({
        userId: p.id,
        type: "GENERAL" as const,
        title: "Fee Receipt Updated",
        message: `${studentName} has updated a fee payment receipt ($${Number(payment.amountPaid).toFixed(2)}). You can view or download it from Student Fees.`,
        link: "/principal/student-fees",
      })),
    });
  }

  return NextResponse.json({
    ok: true,
    payment: {
      id: updated.id,
      receiptUrl: updated.receiptUrl,
      receiptFileName: updated.receiptFileName,
    },
  });
}
