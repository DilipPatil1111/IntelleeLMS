import { NextRequest, NextResponse } from "next/server";
import { requireStudentPortal } from "@/lib/api-auth";
import { db } from "@/lib/db";
import { StudentSubmissionKind } from "@/app/generated/prisma/client";
import { blobPut } from "@/lib/vercel-blob";
import { randomUUID } from "crypto";
import path from "path";

export async function POST(req: NextRequest) {
  const gate = await requireStudentPortal();
  if (!gate.ok) return gate.response;
  const session = gate.session;

  const profile = await db.studentProfile.findUnique({
    where: { userId: session.user.id },
    include: { program: { include: { feeStructures: true } } },
  });

  if (!profile) {
    return NextResponse.json({ error: "Student profile not found" }, { status: 404 });
  }

  const formData = await req.formData();
  const file = formData.get("file") as File | null;
  const amountStr = formData.get("amount") as string | null;
  const feeStructureId = formData.get("feeStructureId") as string | null;

  if (!file) return NextResponse.json({ error: "No file provided" }, { status: 400 });

  const ALLOWED_EXT = new Set([".pdf", ".jpg", ".jpeg", ".png", ".gif", ".webp", ".doc", ".docx"]);
  const MAX_BYTES = 12 * 1024 * 1024; // 12 MB

  const fileExt = path.extname(file.name).toLowerCase();
  if (!ALLOWED_EXT.has(fileExt)) {
    return NextResponse.json({ error: `File type ${fileExt} is not allowed. Accepted: ${[...ALLOWED_EXT].join(", ")}` }, { status: 400 });
  }
  if (file.size > MAX_BYTES) {
    return NextResponse.json({ error: `File too large (max ${MAX_BYTES / 1024 / 1024} MB)` }, { status: 400 });
  }

  const amount = amountStr ? parseFloat(amountStr) : 0;
  if (amount <= 0) return NextResponse.json({ error: "Amount must be greater than 0" }, { status: 400 });

  // Resolve fee structure: by explicit ID, from enrolled programs, or fallback to profile program
  let feeStructure: { id: string } | null = null;
  if (feeStructureId) {
    feeStructure = await db.feeStructure.findUnique({ where: { id: feeStructureId }, select: { id: true } });
  }
  if (!feeStructure) {
    const enrollments = await db.programEnrollment.findMany({
      where: { userId: session.user.id, status: { in: ["ENROLLED", "COMPLETED", "GRADUATED"] } },
      include: { program: { include: { feeStructures: { select: { id: true }, take: 1 } } } },
    });
    for (const e of enrollments) {
      if (e.program.feeStructures.length > 0) {
        feeStructure = e.program.feeStructures[0];
        break;
      }
    }
  }
  if (!feeStructure && profile.program?.feeStructures.length) {
    feeStructure = profile.program.feeStructures[0];
  }
  if (!feeStructure) {
    return NextResponse.json({ error: "No fee structure found for your enrolled programs" }, { status: 400 });
  }

  const buffer = Buffer.from(await file.arrayBuffer());
  const safeName = `${Date.now()}-${randomUUID().slice(0, 8)}${fileExt}`;
  const pathname = `fee-receipts/${session.user.id}/${safeName}`;

  const blob = await blobPut(pathname, buffer, {
    contentType: file.type || "application/octet-stream",
  });

  const payment = await db.feePayment.create({
    data: {
      studentProfileId: profile.id,
      feeStructureId: feeStructure.id,
      amountPaid: amount,
      paymentMethod: "Receipt Upload",
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
      amountPaid: amount,
    },
  });

  // Notify principals about fee receipt submission
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
        title: "Fee Receipt Submitted",
        message: `${studentName} has uploaded a fee payment receipt for $${amount.toFixed(2)}. You can view or download it from Student Fees.`,
        link: "/principal/student-fees",
      })),
    });
  }

  return NextResponse.json({
    ok: true,
    payment: {
      id: payment.id,
      amountPaid: payment.amountPaid,
      receiptUrl: payment.receiptUrl,
      receiptFileName: payment.receiptFileName,
    },
  });
}
