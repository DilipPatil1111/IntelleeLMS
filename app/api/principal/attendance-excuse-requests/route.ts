import { NextResponse } from "next/server";
import { requirePrincipalPortal } from "@/lib/api-auth";
import { db } from "@/lib/db";

export async function GET() {
  const gate = await requirePrincipalPortal();
  if (!gate.ok) return gate.response;

  const requests = await db.attendanceExcuseRequest.findMany({
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
