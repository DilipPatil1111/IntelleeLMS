import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { hasPrincipalPortalAccess } from "@/lib/portal-access";
import { NextResponse } from "next/server";

export const runtime = "nodejs";

/** GET: List students/teachers for a program (or all) for certificate recipient selection. */
export async function GET(req: Request) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!hasPrincipalPortalAccess(session)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { searchParams } = new URL(req.url);
  const programId = searchParams.get("programId");
  const recipientType = searchParams.get("type") || "students";

  if (recipientType === "teachers") {
    const where = programId
      ? { teacherPrograms: { some: { programId } } }
      : {};
    const teachers = await db.user.findMany({
      where: { ...where, role: "TEACHER" },
      select: { id: true, firstName: true, lastName: true, email: true },
      orderBy: { firstName: "asc" },
    });
    return NextResponse.json({
      recipients: teachers.map((t) => ({
        userId: t.id,
        name: `${t.firstName} ${t.lastName}`,
        email: t.email,
      })),
    });
  }

  // Students: from ProgramEnrollment + StudentProfile
  const seen = new Set<string>();
  const recipients: { userId: string; name: string; email: string; enrollmentNo: string }[] = [];

  if (programId) {
    const enrollments = await db.programEnrollment.findMany({
      where: { programId, status: { in: ["ENROLLED", "COMPLETED", "GRADUATED"] } },
      include: {
        user: {
          select: { id: true, firstName: true, lastName: true, email: true },
          include: { studentProfile: { select: { enrollmentNo: true } } },
        },
      },
    });
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

    const profiles = await db.studentProfile.findMany({
      where: { programId, status: { in: ["ENROLLED", "COMPLETED", "GRADUATED"] } },
      include: { user: { select: { id: true, firstName: true, lastName: true, email: true } } },
    });
    for (const p of profiles) {
      if (!seen.has(p.userId)) {
        seen.add(p.userId);
        recipients.push({
          userId: p.userId,
          name: `${p.user.firstName} ${p.user.lastName}`,
          email: p.user.email,
          enrollmentNo: p.enrollmentNo,
        });
      }
    }
  } else {
    const profiles = await db.studentProfile.findMany({
      where: { status: { in: ["ENROLLED", "COMPLETED", "GRADUATED"] } },
      include: { user: { select: { id: true, firstName: true, lastName: true, email: true } } },
      orderBy: { enrollmentNo: "asc" },
    });
    for (const p of profiles) {
      recipients.push({
        userId: p.userId,
        name: `${p.user.firstName} ${p.user.lastName}`,
        email: p.user.email,
        enrollmentNo: p.enrollmentNo,
      });
    }
  }

  return NextResponse.json({ recipients });
}
