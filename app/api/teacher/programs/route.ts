import { requireTeacherPortal } from "@/lib/api-auth";
import { db } from "@/lib/db";
import { NextResponse } from "next/server";

export async function GET() {
  const gate = await requireTeacherPortal();
  if (!gate.ok) return gate.response;
  const session = gate.session;

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
