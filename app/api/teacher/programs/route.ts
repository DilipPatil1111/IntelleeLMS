import { requireTeacherPortal } from "@/lib/api-auth";
import { db } from "@/lib/db";
import { isTeacherOwnershipRestricted } from "@/lib/portal-access";
import { NextResponse } from "next/server";

export async function GET() {
  const gate = await requireTeacherPortal();
  if (!gate.ok) return gate.response;
  const session = gate.session;

  let programs: { id: string; name: string }[];

  if (isTeacherOwnershipRestricted(session)) {
    const profile = await db.teacherProfile.findUnique({
      where: { userId: session.user.id },
      include: { teacherPrograms: { include: { program: true } } },
    });
    programs = profile?.teacherPrograms.map((tp) => ({
      id: tp.program.id,
      name: tp.program.name,
    })) || [];
  } else {
    const allPrograms = await db.program.findMany({
      where: { isActive: true },
      select: { id: true, name: true },
      orderBy: { name: "asc" },
    });
    programs = allPrograms;
  }

  return NextResponse.json({
    programs: programs.map((p) => ({ value: p.id, label: p.name })),
    raw: programs,
  });
}
