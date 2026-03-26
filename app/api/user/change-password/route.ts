import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { NextResponse } from "next/server";

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json();
  const { currentPassword, newPassword } = body as { currentPassword?: string; newPassword?: string };

  if (!currentPassword || !newPassword || newPassword.length < 8) {
    return NextResponse.json(
      { error: "Current password and new password (min 8 characters) are required." },
      { status: 400 }
    );
  }

  const user = await db.user.findUnique({ where: { id: session.user.id } });
  if (!user?.hashedPassword) {
    return NextResponse.json({ error: "Cannot change password for this account." }, { status: 400 });
  }

  const bcrypt = await import("bcryptjs");
  const ok = await bcrypt.compare(currentPassword, user.hashedPassword);
  if (!ok) {
    return NextResponse.json({ error: "Current password is incorrect." }, { status: 400 });
  }

  const hashedPassword = await bcrypt.hash(newPassword, 12);
  await db.user.update({
    where: { id: user.id },
    data: { hashedPassword, mustChangePassword: false },
  });

  return NextResponse.json({ success: true });
}
