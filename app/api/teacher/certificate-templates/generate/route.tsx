import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { hasTeacherPortalAccess, isTeacherOwnershipRestricted } from "@/lib/portal-access";
import { NextResponse } from "next/server";

export const runtime = "nodejs";

export async function GET(req: Request) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!hasTeacherPortalAccess(session)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { searchParams } = new URL(req.url);
  const programId = searchParams.get("programId");
  const recipientType = searchParams.get("type") || "students";

  if (recipientType === "teachers") {
    const where = programId ? { teacherPrograms: { some: { programId } } } : {};
    const teachers = await db.user.findMany({
      where: { ...where, role: "TEACHER" },
      select: { id: true, firstName: true, lastName: true, email: true },
      orderBy: { firstName: "asc" },
    });
    return NextResponse.json({
      recipients: teachers.map((t) => ({ userId: t.id, name: `${t.firstName} ${t.lastName}`, email: t.email })),
    });
  }

  let programIds: string[];

  if (!isTeacherOwnershipRestricted(session)) {
    if (programId) {
      programIds = [programId];
    } else {
      const allProgs = await db.program.findMany({ where: { isActive: true }, select: { id: true } });
      programIds = allProgs.map((p) => p.id);
    }
  } else {
    const teacherPrograms = await db.teacherProgram.findMany({
      where: { teacherProfile: { userId: session.user.id } },
      select: { programId: true },
    });
    programIds = programId ? [programId] : teacherPrograms.map((tp) => tp.programId);
  }

  const enrollments = await db.programEnrollment.findMany({
    where: { programId: { in: programIds }, status: { in: ["ENROLLED", "COMPLETED", "GRADUATED"] } },
    include: {
      user: {
        select: { id: true, firstName: true, lastName: true, email: true },
        include: { studentProfile: { select: { enrollmentNo: true } } },
      },
    },
  });

  const seen = new Set<string>();
  const recipients: { userId: string; name: string; email: string; enrollmentNo: string }[] = [];
  for (const e of enrollments) {
    if (!seen.has(e.userId)) {
      seen.add(e.userId);
      recipients.push({
        userId: e.userId,
        name: `${e.user.firstName} ${e.user.lastName}`,
        email: e.user.email,
        enrollmentNo: (e.user as unknown as { studentProfile?: { enrollmentNo: string } }).studentProfile?.enrollmentNo ?? "",
      });
    }
  }

  return NextResponse.json({ recipients });
}
