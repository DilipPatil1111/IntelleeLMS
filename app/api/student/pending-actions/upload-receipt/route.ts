import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { put } from "@vercel/blob";
import { randomUUID } from "crypto";
import path from "path";

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const profile = await db.studentProfile.findUnique({
    where: { userId: session.user.id },
    include: { program: { include: { feeStructures: true } } },
  });

  if (!profile) {
    return NextResponse.json({ error: "Student profile not found" }, { status: 404 });
  }

  if (!profile.program?.feeStructures.length) {
    return NextResponse.json({ error: "No fee structure found for your program" }, { status: 400 });
  }

  const formData = await req.formData();
  const file = formData.get("file") as File | null;
  const amountStr = formData.get("amount") as string | null;

  if (!file) return NextResponse.json({ error: "No file provided" }, { status: 400 });

  const amount = amountStr ? parseFloat(amountStr) : 0;
  if (amount <= 0) return NextResponse.json({ error: "Amount must be greater than 0" }, { status: 400 });

  const buffer = Buffer.from(await file.arrayBuffer());
  const ext = path.extname(file.name).toLowerCase() || ".bin";
  const safeName = `${Date.now()}-${randomUUID().slice(0, 8)}${ext}`;
  const pathname = `fee-receipts/${session.user.id}/${safeName}`;

  const blob = await put(pathname, buffer, {
    access: "public",
    contentType: file.type || "application/octet-stream",
  });

  const feeStructure = profile.program.feeStructures[0];

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
