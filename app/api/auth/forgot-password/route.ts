import { db } from "@/lib/db";
import { buildPasswordResetEmail } from "@/lib/email";
import { sendEmailWithSignature } from "@/lib/email-signature";
import { getServerAppUrl } from "@/lib/app-url";
import { NextResponse } from "next/server";
import crypto from "crypto";

export async function POST(req: Request) {
  const body = await req.json();
  const email = typeof body.email === "string" ? body.email.trim().toLowerCase() : "";

  if (!email) {
    return NextResponse.json({ error: "Email is required" }, { status: 400 });
  }

  // Always respond with success to prevent email enumeration
  const successResponse = NextResponse.json({
    message: "If an account with that email exists, a password reset link has been sent.",
  });

  const user = await db.user.findUnique({
    where: { email },
    select: { id: true, firstName: true, email: true, isActive: true },
  });

  if (!user || !user.isActive) {
    return successResponse;
  }

  await db.verificationToken.deleteMany({
    where: { identifier: email },
  });

  const token = crypto.randomBytes(32).toString("hex");
  const expires = new Date(Date.now() + 60 * 60 * 1000); // 1 hour

  await db.verificationToken.create({
    data: { identifier: email, token, expires },
  });

  const appUrl = getServerAppUrl().replace(/\/$/, "");
  const resetUrl = `${appUrl}/reset-password?token=${token}&email=${encodeURIComponent(email)}`;

  const emailPayload = buildPasswordResetEmail({
    firstName: user.firstName,
    resetUrl,
  });

  await sendEmailWithSignature({
    to: user.email,
    subject: emailPayload.subject,
    html: emailPayload.html,
    text: emailPayload.text,
  });

  return successResponse;
}
