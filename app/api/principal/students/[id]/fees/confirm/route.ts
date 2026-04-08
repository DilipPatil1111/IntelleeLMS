import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { hasPrincipalPortalAccess } from "@/lib/portal-access";
import { sendEmailWithSignature } from "@/lib/email-signature";
import { NextResponse } from "next/server";

export const runtime = "nodejs";

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!hasPrincipalPortalAccess(session)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { id: userId } = await params;
  const body = await req.json();
  const { paymentId } = body as { paymentId: string; amount?: number };

  if (!paymentId) {
    return NextResponse.json({ error: "paymentId is required" }, { status: 400 });
  }

  // Handle onboarding fee proof (synthetic ID: "onboarding-{userId}")
  const isOnboardingReceipt = paymentId.startsWith("onboarding-");

  let studentEmail = "";
  let studentFirstName = "";
  let studentLastName = "";
  let confirmedAmount = 0;
  let totalPaid = 0;
  let totalFees = 0;
  let receiptUrl: string | null = null;
  let receiptFileName: string | null = null;

  if (isOnboardingReceipt) {
    const onboardingUserId = paymentId.replace("onboarding-", "");
    if (onboardingUserId !== userId) {
      return NextResponse.json({ error: "Payment not found" }, { status: 404 });
    }

    const onboarding = await db.studentOnboarding.findUnique({
      where: { userId },
      select: { feeProofUploadUrl: true, feeProofFileName: true },
    });
    if (!onboarding?.feeProofUploadUrl) {
      return NextResponse.json({ error: "Onboarding fee proof not found" }, { status: 404 });
    }

    const profile = await db.studentProfile.findUnique({
      where: { userId },
      include: {
        user: { select: { firstName: true, lastName: true, email: true } },
        feePayments: { select: { amountPaid: true } },
      },
    });
    if (!profile) {
      return NextResponse.json({ error: "Student profile not found" }, { status: 404 });
    }

    studentEmail = profile.user.email;
    studentFirstName = profile.user.firstName;
    studentLastName = profile.user.lastName;
    receiptUrl = onboarding.feeProofUploadUrl;
    receiptFileName = onboarding.feeProofFileName;
    confirmedAmount = body.amount ?? 0;
    totalPaid = profile.feePayments.reduce((sum, fp) => sum + fp.amountPaid, 0);

    // Compute multi-program fee total
    totalFees = await computeMultiProgramFeesTotal(userId, profile.programId);
  } else {
    const payment = await db.feePayment.findUnique({
      where: { id: paymentId },
      include: {
        studentProfile: {
          include: {
            user: { select: { firstName: true, lastName: true, email: true } },
          },
        },
      },
    });

    if (!payment || payment.studentProfile.userId !== userId) {
      return NextResponse.json({ error: "Payment not found" }, { status: 404 });
    }

    if (payment.confirmedAt) {
      return NextResponse.json({ error: "Payment already confirmed" }, { status: 400 });
    }

    await db.feePayment.update({
      where: { id: paymentId },
      data: {
        confirmedAt: new Date(),
        confirmedById: session.user.id,
      },
    });

    studentEmail = payment.studentProfile.user.email;
    studentFirstName = payment.studentProfile.user.firstName;
    studentLastName = payment.studentProfile.user.lastName;
    receiptUrl = payment.receiptUrl;
    receiptFileName = payment.receiptFileName;
    confirmedAmount = body.amount ?? payment.amountPaid;

    const allPayments = await db.feePayment.findMany({
      where: { studentProfileId: payment.studentProfileId },
      select: { amountPaid: true },
    });
    totalPaid = allPayments.reduce((sum, fp) => sum + fp.amountPaid, 0);

    totalFees = await computeMultiProgramFeesTotal(userId, payment.studentProfile.programId);
  }

  const pendingBalance = totalFees - totalPaid;

  // Fetch receipt for attachment
  const attachments: { filename: string; content: Buffer }[] = [];
  if (receiptUrl) {
    try {
      const res = await fetch(receiptUrl);
      if (res.ok) {
        const arrayBuf = await res.arrayBuffer();
        attachments.push({
          filename: receiptFileName ?? "receipt",
          content: Buffer.from(arrayBuf),
        });
      }
    } catch (e) {
      console.error("Failed to fetch receipt for email attachment:", e);
    }
  }

  const emailResult = await sendEmailWithSignature({
    to: studentEmail,
    subject: `Payment Received — ${studentFirstName} ${studentLastName}`,
    html: `
      <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto;">
        {INSTITUTION_HEADER}
        <p>Dear ${studentFirstName},</p>
        <p>Your payment has been confirmed by the administration.</p>
        <div style="background: #f0fdf4; border: 1px solid #86efac; border-radius: 8px; padding: 16px; margin: 16px 0;">
          ${confirmedAmount > 0 ? `<p style="margin: 0;"><strong>Amount confirmed:</strong> $${Number(confirmedAmount).toLocaleString()}</p>` : ""}
          <p style="margin: 8px 0 0;"><strong>Total paid to date:</strong> $${Number(totalPaid).toLocaleString()}</p>
          <p style="margin: 8px 0 0;"><strong>Pending balance:</strong> $${Number(pendingBalance).toLocaleString()}</p>
        </div>
        <p style="color: #6b7280; font-size: 13px;">If you have any questions about your fees, please contact the administration office.</p>
      </div>
    `,
    text: `Dear ${studentFirstName},\n\nYour payment has been confirmed.\n${confirmedAmount > 0 ? `Amount: $${confirmedAmount}\n` : ""}Total paid: $${totalPaid}\nPending: $${pendingBalance}\n`,
    attachments: attachments.length > 0 ? attachments : undefined,
    senderUserId: session.user.id,
  });

  if (!emailResult.ok) {
    console.error("[fees-confirm] Email failed:", emailResult.error);
    return NextResponse.json({
      ok: true,
      emailSent: false,
      emailError: emailResult.error,
    });
  }

  return NextResponse.json({ ok: true, emailSent: true });
}

async function computeMultiProgramFeesTotal(userId: string, profileProgramId: string | null | undefined): Promise<number> {
  const enrollments = await db.programEnrollment.findMany({
    where: { userId, status: { in: ["ENROLLED", "COMPLETED", "GRADUATED"] } },
    include: { program: { include: { feeStructures: { select: { id: true, totalAmount: true } } } } },
  });

  const seen = new Set<string>();
  let total = 0;
  for (const e of enrollments) {
    for (const fs of e.program.feeStructures) {
      if (!seen.has(fs.id)) {
        seen.add(fs.id);
        total += fs.totalAmount;
      }
    }
  }

  // Fallback: include the profile's primary program fees if not already counted
  if (profileProgramId) {
    const prog = await db.program.findUnique({
      where: { id: profileProgramId },
      include: { feeStructures: { select: { id: true, totalAmount: true } } },
    });
    if (prog) {
      for (const fs of prog.feeStructures) {
        if (!seen.has(fs.id)) {
          seen.add(fs.id);
          total += fs.totalAmount;
        }
      }
    }
  }

  return total;
}
