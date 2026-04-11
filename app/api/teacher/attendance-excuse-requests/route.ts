import { NextResponse } from "next/server";
import { requireTeacherPortal } from "@/lib/api-auth";
import { isTeacherOwnershipRestricted } from "@/lib/portal-access";
import { db } from "@/lib/db";

export async function GET() {
  const gate = await requireTeacherPortal();
  if (!gate.ok) return gate.response;
  const session = gate.session;
  const restricted = isTeacherOwnershipRestricted(session);

  const requests = await db.attendanceExcuseRequest.findMany({
    where: {
      ...(restricted
        ? { attendanceRecord: { session: { createdById: session.user.id } } }
        : {}),
    },
    include: {
      attendanceRecord: {
        include: {
          session: {
            include: {
              subject: { select: { name: true, programId: true } },
              batch: { select: { name: true } },
            },
          },
        },
      },
      student: { select: { id: true, firstName: true, lastName: true, email: true } },
      resolvedBy: { select: { firstName: true, lastName: true } },
    },
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json({ requests });
}
