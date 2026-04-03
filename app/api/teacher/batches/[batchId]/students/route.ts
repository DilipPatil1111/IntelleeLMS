import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { hasTeacherPortalAccess } from "@/lib/portal-access";
import { NextResponse } from "next/server";

/** Students enrolled in a batch (for assessment assignment UI). */
export async function GET(_req: Request, { params }: { params: Promise<{ batchId: string }> }) {
  const { batchId } = await params;
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  if (!hasTeacherPortalAccess(session)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const batch = await db.batch.findUnique({ where: { id: batchId }, select: { id: true } });
  if (!batch) return NextResponse.json({ error: "Batch not found" }, { status: 404 });

  const profiles = await db.studentProfile.findMany({
    where: { batchId },
    include: {
      user: { select: { id: true, firstName: true, lastName: true, email: true } },
    },
    orderBy: { id: "asc" },
  });

  const students = profiles.map((p) => ({
    id: p.user.id,
    firstName: p.user.firstName,
    lastName: p.user.lastName,
    email: p.user.email,
  }));

  return NextResponse.json({ students });
}
