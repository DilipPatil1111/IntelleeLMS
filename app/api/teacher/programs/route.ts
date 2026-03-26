import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { NextResponse } from "next/server";

export async function GET() {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const profile = await db.teacherProfile.findUnique({
    where: { userId: session.user.id },
    include: { teacherPrograms: { include: { program: true } } },
  });

  const programs =
    profile?.teacherPrograms.map((tp) => ({
      id: tp.program.id,
      name: tp.program.name,
    })) || [];

  return NextResponse.json({
    programs: programs.map((p) => ({ value: p.id, label: p.name })),
    raw: programs,
  });
}
