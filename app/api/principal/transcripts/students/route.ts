import { requirePrincipalPortal } from "@/lib/api-auth";
import { db } from "@/lib/db";
import { NextResponse } from "next/server";

/** Flat list of all active students — for use in transcript form. */
export async function GET(req: Request) {
  const gate = await requirePrincipalPortal();
  if (!gate.ok) return gate.response;

  const { searchParams } = new URL(req.url);
  const programId = searchParams.get("programId") || undefined;

  const users = await db.user.findMany({
    where: programId
      ? {
          role: "STUDENT",
          programEnrollments: {
            some: {
              programId,
              status: { in: ["ENROLLED", "COMPLETED", "GRADUATED"] },
            },
          },
        }
      : { role: "STUDENT", isActive: true },
    select: { id: true, firstName: true, lastName: true, studentProfile: { select: { enrollmentNo: true } } },
    orderBy: [{ firstName: "asc" }, { lastName: "asc" }],
    take: 500,
  });

  const students = users.map((u) => ({
    id: u.id,
    firstName: u.firstName,
    lastName: u.lastName,
    enrollmentNo: u.studentProfile?.enrollmentNo ?? null,
  }));

  return NextResponse.json({ students });
}
