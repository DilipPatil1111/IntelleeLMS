import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import type { Prisma } from "@/app/generated/prisma/client";
import type { FeedbackCategory, FeedbackAuthorRole } from "@/app/generated/prisma/enums";
import { hasPrincipalPortalAccess } from "@/lib/portal-access";
import { NextResponse } from "next/server";

export async function GET(req: Request) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  if (!hasPrincipalPortalAccess(session)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { searchParams } = new URL(req.url);
  const q = searchParams.get("q")?.trim();
  const category = searchParams.get("category") as FeedbackCategory | null;
  const role = searchParams.get("role") as FeedbackAuthorRole | null;

  const and: Prisma.FeedbackWhereInput[] = [];
  if (q) {
    and.push({
      OR: [
        { message: { contains: q, mode: "insensitive" } },
        { title: { contains: q, mode: "insensitive" } },
        { author: { firstName: { contains: q, mode: "insensitive" } } },
        { author: { lastName: { contains: q, mode: "insensitive" } } },
        { author: { email: { contains: q, mode: "insensitive" } } },
      ],
    });
  }
  if (category) and.push({ category });
  if (role) and.push({ authorRole: role });

  const feedback = await db.feedback.findMany({
    where: and.length ? { AND: and } : undefined,
    include: {
      author: { select: { id: true, firstName: true, lastName: true, email: true, role: true } },
      aboutStudent: { select: { id: true, firstName: true, lastName: true, email: true } },
      aboutTeacher: { select: { id: true, firstName: true, lastName: true, email: true } },
      repliedBy: { select: { id: true, firstName: true, lastName: true } },
    },
    orderBy: { createdAt: "desc" },
    take: 200,
  });

  return NextResponse.json({ feedback });
}
