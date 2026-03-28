import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { NextResponse } from "next/server";

export const runtime = "nodejs";

export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const role = (session.user as unknown as Record<string, unknown>).role as string;
  if (role !== "PRINCIPAL") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { id: studentUserId } = await params;

  const profile = await db.studentProfile.findUnique({ where: { userId: studentUserId } });
  if (!profile) return NextResponse.json({ error: "Student not found" }, { status: 404 });

  await db.studentOnboarding.upsert({
    where: { userId: studentUserId },
    update: { principalConfirmedAt: new Date() },
    create: { userId: studentUserId, principalConfirmedAt: new Date() },
  });

  const user = await db.user.findUnique({
    where: { id: studentUserId },
    select: { email: true, firstName: true },
  });

  if (user?.email) {
    await db.notification.create({
      data: {
        userId: studentUserId,
        type: "GENERAL",
        title: "Onboarding approved",
        message: "Your principal has confirmed your onboarding. Full course access is now available.",
        link: "/student/program",
      },
    });
  }

  return NextResponse.json({ success: true });
}
