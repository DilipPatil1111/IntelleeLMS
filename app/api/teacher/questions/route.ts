import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { NextResponse } from "next/server";

export async function GET() {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const questions = await db.question.findMany({
    where: { assessment: { createdById: session.user.id } },
    include: { assessment: { include: { subject: true } }, options: true },
    orderBy: { createdAt: "desc" },
    take: 200,
  });

  return NextResponse.json({ questions });
}
