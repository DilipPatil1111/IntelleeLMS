import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import type { Prisma } from "@/app/generated/prisma/client";
import type { ApplicationStatus } from "@/app/generated/prisma/enums";
import { syncMissingProgramApplicationsFromProfiles } from "@/lib/sync-program-applications";
import { hasPrincipalPortalAccess } from "@/lib/portal-access";
import { NextResponse } from "next/server";

export async function GET(req: Request) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!hasPrincipalPortalAccess(session)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  await syncMissingProgramApplicationsFromProfiles();

  const { searchParams } = new URL(req.url);
  const q = searchParams.get("q")?.trim();
  const programId = searchParams.get("programId") || undefined;
  const status = searchParams.get("status") || undefined;

  const and: Prisma.ProgramApplicationWhereInput[] = [];

  if (q) {
    and.push({
      OR: [
        { applicant: { firstName: { contains: q, mode: "insensitive" } } },
        { applicant: { lastName: { contains: q, mode: "insensitive" } } },
        { applicant: { email: { contains: q, mode: "insensitive" } } },
      ],
    });
  }
  if (programId) and.push({ programId });
  if (status) and.push({ status: status as ApplicationStatus });

  const applications = await db.programApplication.findMany({
    where: and.length ? { AND: and } : undefined,
    include: {
      applicant: {
        select: {
          id: true,
          firstName: true,
          lastName: true,
          email: true,
          phone: true,
          profilePicture: true,
          studentProfile: {
            select: {
              enrollmentNo: true,
              programId: true,
              batchId: true,
              status: true,
            },
          },
        },
      },
      program: {
        select: {
          id: true,
          name: true,
          code: true,
          batches: { where: { isActive: true }, select: { id: true, name: true } },
        },
      },
      batch: { select: { id: true, name: true } },
    },
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json({ applications });
}
