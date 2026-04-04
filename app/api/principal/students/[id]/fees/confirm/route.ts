import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { sendEmail } from "@/lib/email";
import { NextResponse } from "next/server";

export const runtime = "nodejs";

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user || session.user.role !== "PRINCIPAL") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id: userId } = await params;
  const body = await req.json();
  const { paymentId } = body as { paymentId: string; amount?: number };

  if (!paymentId) {
    return NextResponse.json({ error: "paymentId is required" }, { status: 400 });
  }

  const payment = await db.feePayment.findUnique({
    where: { id: paymentId },
    include: {
      studentProfile: {
        include: {
          user: { select: { firstName: true, lastName: true, email: true } },
          program: { include: { feeStructures: { select: { totalAmount: true } } } },
        },
      },
    },
  });

  if (!payment || payment.studentProfile.userId !== userId) {
    return NextResponse.json({ error: "Payment not found" }, { status: 404 });
  }

  await db.feePayment.update({
    where: { id: paymentId },
    data: {
      confirmedAt: new Date(),
      confirmedById: session.user.id,
    },
  });

  const { user } = payment.studentProfile;
  const totalFees =
    payment.studentProfile.program?.feeStructures.reduce((sum, fs) => sum + fs.totalAmount, 0) ?? 0;

  const allPayments = await db.feePayment.findMany({
    where: { studentProfileId: payment.studentProfileId },
    select: { amountPaid: true },
  });
  const totalPaid = allPayments.reduce((sum, fp) => sum + fp.amountPaid, 0);
  const pendingBalance = totalFees - totalPaid;

  const attachments: { filename: string; content: Buffer }[] = [];
  if (payment.receiptUrl) {
    try {
      const res = await fetch(payment.receiptUrl);
      if (res.ok) {
        const arrayBuf = await res.arrayBuffer();
        attachments.push({
          filename: payment.receiptFileName ?? "receipt",
          content: Buffer.from(arrayBuf),
        });
      }
    } catch (e) {
      console.error("Failed to fetch receipt for email attachment:", e);
    }
  }

  const confirmedAmount = body.amount ?? payment.amountPaid;

  await sendEmail({
    to: user.email,
    subject: `Payment Received — ${user.firstName} ${user.lastName}`,
    html: `
      <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #4f46e5;">Intellee College</h2>
        <p>Dear ${user.firstName},</p>
        <p>Your payment has been confirmed by the administration.</p>
        <div style="background: #f0fdf4; border: 1px solid #86efac; border-radius: 8px; padding: 16px; margin: 16px 0;">
          <p style="margin: 0;"><strong>Amount confirmed:</strong> $${Number(confirmedAmount).toLocaleString()}</p>
          <p style="margin: 8px 0 0;"><strong>Total paid to date:</strong> $${Number(totalPaid).toLocaleString()}</p>
          <p style="margin: 8px 0 0;"><strong>Pending balance:</strong> $${Number(pendingBalance).toLocaleString()}</p>
        </div>
        <p style="color: #6b7280; font-size: 13px;">If you have any questions about your fees, please contact the administration office.</p>
      </div>
    `,
    attachments: attachments.length > 0 ? attachments : undefined,
  });

  return NextResponse.json({ ok: true });
}
