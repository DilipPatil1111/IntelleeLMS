import { db } from "@/lib/db";
import { NextResponse } from "next/server";

export async function POST(req: Request) {
  const body = await req.json();
  const { token, email, password } = body as {
    token?: string;
    email?: string;
    password?: string;
  };

  if (!token || !email || !password) {
    return NextResponse.json({ error: "Token, email, and password are required" }, { status: 400 });
  }

  if (password.length < 8) {
    return NextResponse.json({ error: "Password must be at least 8 characters" }, { status: 400 });
  }

  const record = await db.verificationToken.findFirst({
    where: { identifier: email.toLowerCase(), token },
  });

  if (!record) {
    return NextResponse.json({ error: "Invalid or expired reset link. Please request a new one." }, { status: 400 });
  }

  if (record.expires < new Date()) {
    await db.verificationToken.deleteMany({ where: { identifier: email.toLowerCase(), token } });
    return NextResponse.json({ error: "This reset link has expired. Please request a new one." }, { status: 400 });
  }

  const bcrypt = await import("bcryptjs");
  const hashedPassword = await bcrypt.hash(password, 12);

  await db.$transaction([
    db.user.update({
      where: { email: email.toLowerCase() },
      data: { hashedPassword, mustChangePassword: false },
    }),
    db.verificationToken.deleteMany({
      where: { identifier: email.toLowerCase() },
    }),
  ]);

  return NextResponse.json({ success: true });
}
