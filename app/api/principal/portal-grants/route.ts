import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { hasPrincipalPortalAccess } from "@/lib/portal-access";
import type { Role } from "@/app/generated/prisma/enums";
import { NextResponse } from "next/server";

const PORTALS: Role[] = ["STUDENT", "TEACHER", "PRINCIPAL"];

export async function GET() {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!hasPrincipalPortalAccess(session)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const grants = await db.userPortalGrant.findMany({
    orderBy: { createdAt: "desc" },
    include: {
      user: { select: { id: true, email: true, firstName: true, lastName: true, role: true } },
      createdBy: { select: { id: true, email: true, firstName: true, lastName: true } },
    },
  });

  return NextResponse.json({ grants });
}

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!hasPrincipalPortalAccess(session)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const body = await req.json().catch(() => ({}));
  const userId = typeof body.userId === "string" ? body.userId.trim() : "";
  const portal = body.portal as Role | undefined;
  if (!userId || !portal || !PORTALS.includes(portal)) {
    return NextResponse.json(
      { error: "userId and portal (STUDENT | TEACHER | PRINCIPAL) required" },
      { status: 400 }
    );
  }

  const target = await db.user.findUnique({ where: { id: userId }, select: { id: true, role: true } });
  if (!target) return NextResponse.json({ error: "User not found" }, { status: 404 });
  if (target.role === portal) {
    return NextResponse.json(
      { error: "That portal already matches the user’s primary role; no extra grant is stored." },
      { status: 400 }
    );
  }

  await db.userPortalGrant.upsert({
    where: { userId_portal: { userId, portal } },
    create: { userId, portal, createdById: session.user.id },
    update: { createdById: session.user.id },
  });

  return NextResponse.json({ success: true });
}

export async function DELETE(req: Request) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!hasPrincipalPortalAccess(session)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { searchParams } = new URL(req.url);
  const userId = searchParams.get("userId")?.trim();
  const id = searchParams.get("id")?.trim();

  /** Remove every extra portal grant for this user (restore access to primary role only). */
  if (userId) {
    const target = await db.user.findUnique({ where: { id: userId }, select: { id: true } });
    if (!target) return NextResponse.json({ error: "User not found" }, { status: 404 });
    const result = await db.userPortalGrant.deleteMany({ where: { userId } });
    return NextResponse.json({ success: true, removed: result.count });
  }

  if (!id) return NextResponse.json({ error: "id or userId required" }, { status: 400 });

  try {
    await db.userPortalGrant.delete({ where: { id } });
  } catch {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  return NextResponse.json({ success: true, removed: 1 });
}
